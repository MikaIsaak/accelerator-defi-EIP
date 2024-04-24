// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity 0.8.24;

import {ERC20} from "./ERC20.sol";

abstract contract IERC4626 is ERC20 {
    /*///////////////////////////////////////////////////////////////
                                Events
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Deposit event.
     * @dev Emitted after the deposit.
     *
     * @param sender The address of the account that performed the deposit.
     * @param owner The address that received the shares created after the deposit.
     * @param assets The amount of assets that were deposited.
     * @param shares The number of shares that were minted as a result of the deposit.
     */
    event Deposit(address indexed sender, address indexed owner, uint256 assets, uint256 shares);

    /**
     * @notice Withdraw event.
     * @dev Emitted when shares are withdrawn from the vault in exchange for underlying assets.
     *
     * @param sender The address of the account that initiated the withdrawal.
     * @param receiver The address where the withdrawn assets were sent.
     * @param assets The amount of assets withdrawn.
     * @param shares The number of shares that were burned as a result of the withdrawal.
     */
    event Withdraw(address indexed sender, address indexed receiver, uint256 assets, uint256 shares);

    /**
     * @dev Error thrown when an operation would result zero shares.
     * @param numberOfShares The number of shares.
     */
    error ZeroShares(uint256 numberOfShares);

    /*///////////////////////////////////////////////////////////////
                            Mutable Functions
    //////////////////////////////////////////////////////////////*/

    /**
     * @dev Deposits staking token to the Vault and returns shares.
     *
     * @param assets The amount of staking token to send.
     * @param receiver The shares receiver address.
     * @return shares The amount of shares to receive.
     */
    function deposit(uint256 assets, address receiver) public virtual returns (uint256 shares);

    /**
     * @dev Mints the underlying token.
     *
     * @param shares The amount of shares to send.
     * @param receiver The receiver of tokens.
     * @return amount The amount of tokens to receive.
     */
    function mint(uint256 shares, address receiver) public virtual returns (uint256 amount);

    /**
     * @dev Withdraws staking token and burns shares.
     *
     * @param assets The amount of shares.
     * @param receiver The staking token receiver.
     * @param _owner The owner of the shares.
     * @return shares The amount of shares to burn.
     */
    function withdraw(uint256 assets, address receiver, address _owner) public virtual returns (uint256 shares);

    /**
     * @dev Redeems shares for underlying assets.
     *
     * @param shares The amount of shares.
     * @param receiver The staking token receiver.
     * @param _owner The owner of the shares.
     * @return amount The amount of shares to burn.
     */
    function redeem(uint256 shares, address receiver, address _owner) public virtual returns (uint256 amount);

    /*///////////////////////////////////////////////////////////////
                            View Functions
    //////////////////////////////////////////////////////////////*/

    /**
     * @dev Returns amount of assets on the balance of this contract
     *
     * @return Asset balance of this contract
     */
    function totalAssets() public view virtual returns (uint256);

    /**
     * @dev Calculates the amount of underlying assets.
     *
     * @param user The address of the user.
     * @return The amount of underlying assets equivalent to the user's shares.
     */
    function assetsOf(address user) public view virtual returns (uint256);

    /**
     * @dev Calculates how much one share is worth in terms of the underlying asset.
     *
     * @return The amount of assets one share can redeem.
     */
    function assetsPerShare() public view virtual returns (uint256);

    /**
     * @dev Returns the maximum number of underlying assets that can be deposited by user.
     *
     * @return The maximum amount of assets that can be deposited.
     */
    function maxDeposit(address) public virtual returns (uint256);

    /**
     * @dev Returns the maximum number of shares that can be minted by any user.
     *
     * @return The maximum number of shares that can be minted.
     */
    function maxMint(address) public virtual returns (uint256);

    /**
     * @dev Returns the maximum number of shares that can be redeemed by the owner.
     *
     * @param _owner The address of the owner.
     * @return The maximum number of shares that can be redeemed.
     */
    function maxRedeem(address _owner) public view virtual returns (uint256);

    /**
     * @dev Calculates the maximum amount of assets that can be withdrawn.
     *
     * @param _owner The address of the owner.
     * @return The maximum amount of assets that can be withdrawn.
     */
    function maxWithdraw(address _owner) public view virtual returns (uint256);

    /**
     * @dev Calculates the number of shares that will be minted for a given amount.
     *
     * @param assets The amount of underlying assets to deposit.
     * @return shares The estimated number of shares that would be minted.
     */
    function previewDeposit(uint256 assets) public view virtual returns (uint256 shares);

    /**
     * @dev Calculates the amount of underlying assets equivalent to a given number of shares.
     *
     * @param shares The number of shares to be minted.
     * @return amount The estimated amount of underlying assets.
     */
    function previewMint(uint256 shares) public view virtual returns (uint256 amount);

    /**
     * @dev Calculates the number of shares that would be burned for a given amount of assets.
     *
     * @param assets The amount of underlying assets to withdraw.
     * @return shares The estimated number of shares that would be burned.
     */
    function previewWithdraw(uint256 assets) public view virtual returns (uint256 shares);

    /**
     * @dev Calculates the amount of underlying assets equivalent to a specific number of shares.
     *
     * @param shares The number of shares to redeem.
     * @return amount The estimated amount of underlying assets that would be redeemed.
     */
    function previewRedeem(uint256 shares) public view virtual returns (uint256 amount);
}
