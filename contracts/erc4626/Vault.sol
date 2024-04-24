// SPDX-License-Identifier: MIT

pragma solidity 0.8.24;
pragma abicoder v2;

import {ERC20} from "./ERC20.sol";
import {IERC4626} from "./IERC4626.sol";
import {FixedPointMathLib} from "./FixedPointMathLib.sol";
import {SafeTransferLib} from "./SafeTransferLib.sol";
import "../common/safe-HTS/SafeHTS.sol";
import "../common/safe-HTS/IHederaTokenService.sol";

/**
 * @title The Vault ERC4626 contract ????????????????????????
 */
contract HederaVault is IERC4626 {
    // Enables safer ERC20 interactions.
    using SafeTransferLib for ERC20;
    // Provides fixed-point math operations.
    using FixedPointMathLib for uint256;
    // Provides bit manipulation capabilities.
    using Bits for uint256;

    // The ERC20 token used as the vault's underlying asset.
    ERC20 public immutable asset;
    // Address of the new token created by this vault.
    address public newTokenAddress;
    // Total amount of the underlying token currently managed by the vault.
    uint public totalTokens;
    // Dynamic array to store addresses of reward tokens associated with the vault.
    address[] public tokenAddress;
    // Owner of the vault.
    address public owner;

    /**
     * @notice CreatedToken event.
     * @dev Emitted after contract initialization, when represented shares token is deployed.
     *
     * @param createdToken The address of created token.
     */
    event CreatedToken(address indexed createdToken);

    /**
     * @dev Initializes contract with passed parameters
     *
     * @param _underlying The address of the asset token
     * @param _name The token name
     * @param _symbol The token symbol
     */
    constructor(
        ERC20 _underlying,
        string memory _name,
        string memory _symbol
    ) payable ERC20(_name, _symbol, _underlying.decimals()) {
        owner = msg.sender;

        SafeHTS.safeAssociateToken(address(_underlying), address(this));
        uint256 supplyKeyType;
        uint256 adminKeyType;

        IHederaTokenService.KeyValue memory supplyKeyValue;
        supplyKeyType = supplyKeyType.setBit(4);
        supplyKeyValue.delegatableContractId = address(this);

        IHederaTokenService.KeyValue memory adminKeyValue;
        adminKeyType = adminKeyType.setBit(0);
        adminKeyValue.delegatableContractId = address(this);

        IHederaTokenService.TokenKey[] memory keys = new IHederaTokenService.TokenKey[](2);

        keys[0] = IHederaTokenService.TokenKey(supplyKeyType, supplyKeyValue);
        keys[1] = IHederaTokenService.TokenKey(adminKeyType, adminKeyValue);

        IHederaTokenService.Expiry memory expiry;
        expiry.autoRenewAccount = address(this);
        expiry.autoRenewPeriod = 8000000;

        IHederaTokenService.HederaToken memory newToken;
        newToken.name = _name;
        newToken.symbol = _symbol;
        newToken.treasury = address(this);
        newToken.expiry = expiry;
        newToken.tokenKeys = keys;
        newTokenAddress = SafeHTS.safeCreateFungibleToken(newToken, 0, _underlying.decimals());
        emit CreatedToken(newTokenAddress);
        asset = _underlying;
    }

    struct UserInfo {
        // Number of shares owned by the user.
        uint num_shares;
        // Mapping from token address to the last amount of rewards claimed by the user.
        mapping(address => uint) lastClaimedAmountT;
        // Flag to indicate whether the user has an existing record.
        bool exist;
    }

    struct RewardsInfo {
        // Total amount of rewards allocated for the token.
        uint amount;
        // Flag to indicate whether rewards for the token are active.
        bool exist;
    }

    mapping(address => UserInfo) public userContribution;
    mapping(address => RewardsInfo) public rewardsAddress;

    /*///////////////////////////////////////////////////////////////
                        DEPOSIT/WITHDRAWAL LOGIC
    //////////////////////////////////////////////////////////////*/

    /**
     * @dev Deposits staking token to the Vault and returns shares.
     *
     * @param assets The amount of staking token to send.
     * @param receiver The shares receiver address.
     * @return shares The amount of shares to receive.
     */
    function deposit(uint256 assets, address receiver) public override returns (uint256 shares) {
        if ((shares = previewDeposit(assets)) == 0) revert ZeroShares(assets);

        asset.safeTransferFrom(msg.sender, address(this), assets);

        totalTokens += assets;

        SafeHTS.safeMintToken(newTokenAddress, uint64(assets), new bytes[](0));

        SafeHTS.safeTransferToken(newTokenAddress, address(this), msg.sender, int64(uint64(assets)));

        emit Deposit(msg.sender, receiver, assets, shares);

        afterDeposit(assets);
    }

    /**
     * @dev Mints the underlying token.
     *
     * @param shares The amount of shares to send.
     * @param receiver The receiver of the tokens.
     * @return amount The amount of the tokens to receive.
     */
    function mint(uint256 shares, address receiver) public override returns (uint256 amount) {
        _mint(receiver, amount = previewMint(shares));

        asset.approve(address(this), amount);

        totalTokens += amount;

        emit Deposit(msg.sender, receiver, amount, shares);

        asset.safeTransferFrom(msg.sender, address(this), amount);

        afterDeposit(amount);
    }

    /**
     * @dev Withdraws staking token and burns shares.
     *
     * @param assets The amount of shares.
     * @param receiver The staking token receiver.
     * @param _owner The owner of the shares.
     * @return shares The amount of the shares to burn.
     */
    function withdraw(uint256 assets, address receiver, address _owner) public override returns (uint256 shares) {
        beforeWithdraw(assets);

        SafeHTS.safeTransferToken(newTokenAddress, msg.sender, address(this), int64(uint64(assets)));

        SafeHTS.safeBurnToken(newTokenAddress, uint64(assets), new int64[](0));

        // _burn(from, shares = previewWithdraw(amount));
        totalTokens -= assets;

        emit Withdraw(_owner, receiver, assets, shares);

        asset.safeTransfer(receiver, assets);
    }

    /**
     * @dev Redeems shares for underlying assets.
     *
     * @param shares The amount of shares.
     * @param receiver The staking token receiver.
     * @param _owner The owner of the shares.
     * @return amount The amount of shares to burn.
     */
    function redeem(uint256 shares, address receiver, address _owner) public override returns (uint256 amount) {
        require((amount = previewRedeem(shares)) != 0, "ZERO_ASSETS");

        amount = previewRedeem(shares);
        _burn(_owner, shares);
        totalTokens -= amount;

        emit Withdraw(_owner, receiver, amount, shares);

        asset.safeTransfer(receiver, amount);
    }

    /*///////////////////////////////////////////////////////////////
                         INTERNAL HOOKS LOGIC
    //////////////////////////////////////////////////////////////*/

    /**
     * @dev Updates user state according to withdraw inputs.
     *
     * @param amount The amount of shares.
     */
    function beforeWithdraw(uint256 amount) internal {
        // claimAllReward(0);
        userContribution[msg.sender].num_shares -= amount;
        totalTokens -= amount;
    }

    /**
     * @dev Updates user state according to withdraw inputs.
     *
     * @param amount The amount of shares.
     */
    function afterDeposit(uint256 amount) internal {
        if (!userContribution[msg.sender].exist) {
            for (uint i; i < tokenAddress.length; i++) {
                address token = tokenAddress[i];
                userContribution[msg.sender].lastClaimedAmountT[token] = rewardsAddress[token].amount;
                SafeHTS.safeAssociateToken(token, msg.sender);
            }
            userContribution[msg.sender].num_shares = amount;
            userContribution[msg.sender].exist = true;
            totalTokens += amount;
        } else {
            claimAllReward(0);
            userContribution[msg.sender].num_shares += amount;
            totalTokens += amount;
        }
    }

    /*///////////////////////////////////////////////////////////////
                        ACCOUNTING LOGIC
    //////////////////////////////////////////////////////////////*/

    /**
     * @dev Returns amount of assets on the balance of this contract
     *
     * @return Asset balance of this contract
     */
    function totalAssets() public view override returns (uint256) {
        return asset.balanceOf(address(this));
    }

    /**
     * @dev Calculates the amount of underlying assets.
     *
     * @param user The address of the user.
     * @return The amount of underlying assets equivalent to the user's shares.
     */
    function assetsOf(address user) public view override returns (uint256) {
        return previewRedeem(balanceOf[user]);
    }

    /**
     * @dev Calculates how much one share is worth in terms of the underlying asset.
     *
     * @return The amount of assets one share can redeem.
     */
    function assetsPerShare() public view override returns (uint256) {
        return previewRedeem(10 ** decimals);
    }

    /**
     * @dev Returns the maximum number of underlying assets that can be deposited by user.
     *
     * @return The maximum amount of assets that can be deposited.
     */
    function maxDeposit(address) public pure override returns (uint256) {
        return type(uint256).max;
    }

    /**
     * @dev Returns the maximum number of shares that can be minted by any user.
     *
     * @return The maximum number of shares that can be minted.
     */
    function maxMint(address) public pure override returns (uint256) {
        return type(uint256).max;
    }

    /**
     * @dev Calculates the maximum amount of assets that can be withdrawn.
     *
     * @param _owner The address of the owner.
     * @return The maximum amount of assets that can be withdrawn.
     */
    function maxWithdraw(address _owner) public view override returns (uint256) {
        return assetsOf(_owner);
    }

    /**
     * @dev Returns the maximum number of shares that can be redeemed by the owner.
     *
     * @param _owner The address of the owner.
     * @return The maximum number of shares that can be redeemed.
     */
    function maxRedeem(address _owner) public view override returns (uint256) {
        return balanceOf[_owner];
    }

    /**
     * @dev Calculates the number of shares that will be minted for a given amount.
     *
     * @param assets The amount of underlying assets to deposit.
     * @return shares The estimated number of shares that would be minted.
     */
    function previewDeposit(uint256 assets) public view override returns (uint256 shares) {
        uint256 supply = totalSupply;

        return supply == 0 ? assets : assets.mulDivDown(1, totalAssets());
    }

    /**
     * @dev Calculates the amount of underlying assets equivalent to a given number of shares.
     *
     * @param shares The number of shares to be minted.
     * @return amount The estimated amount of underlying assets.
     */
    function previewMint(uint256 shares) public view override returns (uint256 amount) {
        uint256 supply = totalSupply;

        return supply == 0 ? shares : shares.mulDivUp(totalAssets(), totalSupply);
    }

    /**
     * @dev Calculates the number of shares that would be burned for a given amount of assets.
     *
     * @param assets The amount of underlying assets to withdraw.
     * @return shares The estimated number of shares that would be burned.
     */
    function previewWithdraw(uint256 assets) public view override returns (uint256 shares) {
        uint256 supply = asset.balanceOf(address(this));

        return supply == 0 ? assets : assets.mulDivUp(supply, totalAssets());
    }

    /**
     * @dev Calculates the amount of underlying assets equivalent to a specific number of shares.
     *
     * @param shares The number of shares to redeem.
     * @return amount The estimated amount of underlying assets that would be redeemed.
     */
    function previewRedeem(uint256 shares) public view override returns (uint256 amount) {
        uint256 supply = totalSupply;

        return supply == 0 ? shares : shares.mulDivDown(totalAssets(), totalSupply);
    }

    /*///////////////////////////////////////////////////////////////
                        REWARDS LOGIC
    //////////////////////////////////////////////////////////////*/

    /**
     * @dev Adds a new reward token and its distribution amount to the vault.
     *
     * @param _token The address of the reward token to add.
     * @param _amount The total amount of the reward token.
     */
    function addReward(address _token, uint _amount) public payable {
        require(_amount != 0, "please provide amount");
        require(totalTokens != 0, "no token staked yet");
        require(msg.sender == owner, "Only owner");

        uint perShareRewards;
        perShareRewards = _amount.mulDivDown(1, totalTokens);
        if (!rewardsAddress[_token].exist) {
            tokenAddress.push(_token);
            rewardsAddress[_token].exist = true;
            rewardsAddress[_token].amount = perShareRewards;
            SafeHTS.safeAssociateToken(_token, address(this));
            ERC20(_token).safeTransferFrom(address(msg.sender), address(this), _amount);
        } else {
            rewardsAddress[_token].amount += perShareRewards;
            ERC20(_token).safeTransferFrom(address(msg.sender), address(this), _amount);
        }
    }

    /**
     * @dev Claims all pending reward tokens for the caller.
     *
     * @param _startPosition The starting index in the reward token list from which to begin claiming rewards.
     * @return The index of the start position after the last claimed reward and the total number of reward tokens.
     */
    function claimAllReward(uint _startPosition) public returns (uint, uint) {
        //claim
        for (uint i = _startPosition; i < tokenAddress.length && i < _startPosition + 10; i++) {
            uint reward;
            address token = tokenAddress[i];
            reward = (rewardsAddress[token].amount - userContribution[msg.sender].lastClaimedAmountT[token]).mulDivDown(
                    1,
                    userContribution[msg.sender].num_shares
                );
            userContribution[msg.sender].lastClaimedAmountT[token] = rewardsAddress[token].amount;
            ERC20(token).safeTransferFrom(address(this), msg.sender, reward);
        }
        return (_startPosition, tokenAddress.length);
    }
}

/**
 * @title Bits Library
 * @dev A library for bit manipulation operations on uint256 values.
 */
library Bits {
    uint256 internal constant ONE = uint256(1);

    /**
     * @dev Performs a bitwise OR operation between the original number and the bit shifted by `index` positions to the left.
     *
     * @param self The original uint256 number.
     * @param index The position of the bit to set.
     * @return The uint256 number after setting the specified bit to 1. ???????????????????????????????
     */
    function setBit(uint256 self, uint8 index) internal pure returns (uint256) {
        return self | (ONE << index);
    }
}
