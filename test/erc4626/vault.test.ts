import { anyValue, ethers, expect } from "../setup";
import {
    TokenTransfer,
    createFungibleToken,
    TokenBalance,
    createAccount,
    addToken,
    mintToken,
} from "../../scripts/utils";
import { PrivateKey, Client, AccountId, TokenAssociateTransaction } from "@hashgraph/sdk";
import hre from "hardhat";
import config from "./config.json";
import { any } from "hardhat/internal/core/params/argumentTypes";

describe("Vault", function () {
    async function deployFixture() {
        const [owner] = await ethers.getSigners();

        let client = Client.forTestnet();

        const operatorPrKey = PrivateKey.fromStringECDSA(process.env.PRIVATE_KEY || "");
        const operatorAccountId = AccountId.fromString(process.env.ACCOUNT_ID || "");

        client.setOperator(operatorAccountId, operatorPrKey);

        const erc20 = await hre.artifacts.readArtifact("contracts/erc4626/ERC20.sol:ERC20");

        // const rewardToken = await createFungibleToken(
        //     "Reward Token 1",
        //     "RT1",
        //     process.env.ACCOUNT_ID,
        //     operatorPrKey.publicKey,
        //     client,
        //     operatorPrKey
        // );

        // console.log("Reward token addrress", rewardToken?.toSolidityAddress());

        const sharesTokenAssociate = await new TokenAssociateTransaction()
            .setAccountId(operatorAccountId)
            .setTokenIds([config.sharesTokenId])
            .execute(client);

        const stakingTokenAssociate = await new TokenAssociateTransaction()
            .setAccountId(operatorAccountId)
            .setTokenIds([config.stakingTokenId])
            .execute(client);

        const rewardTokenAssociate = await new TokenAssociateTransaction()
            .setAccountId(operatorAccountId)
            .setTokenIds([config.rewardTokenId])
            .execute(client);

        const hederaVaultRevertCases = await ethers.getContractAt("HederaVault", config.vaultEr);
        const hederaVault = await ethers.getContractAt("HederaVault", config.vault);

        const rewardToken = await ethers.getContractAt(erc20.abi, config.rewardTokenAddress);

        const stakingToken = await ethers.getContractAt(erc20.abi, await hederaVault.asset());

        const sharesToken = await ethers.getContractAt(erc20.abi, config.sharesTokenAddress);

        // await rewardToken.approve(hederaVault.target, 3 * 1e8);

        // const tx = await hederaVault.addReward(rewardTokenAddress, 3 * 1e8, { gasLimit: 3000000, value: ethers.parseUnits("5", 18) });
        // console.log(tx.hash);

        // console.log("TOTAL TOKENS", (await hederaVault.rewardsAddress(rewardTokenAddress)).amount);

        return {
            hederaVault,
            hederaVaultRevertCases,
            rewardToken,
            stakingToken,
            sharesToken,
            client,
            owner,
        };
    }

    describe("deposit", function () {
        it.only("Should deposit tokens and return shares", async function () {
            const { hederaVault, owner, stakingToken, sharesToken } = await deployFixture();
            const amountToDeposit = 450;

            console.log("Preview deposit ", await hederaVault.previewDeposit(amountToDeposit));

            const tx = await hederaVault.connect(owner).deposit(amountToDeposit, owner.address, { gasLimit: 3000000 });

            console.log(tx.hash);

            await expect(tx)
                .to.emit(hederaVault, "Deposit")
                .withArgs(owner.address, owner.address, amountToDeposit, anyValue);
        });

        it.only("Should revert if zero shares", async function () {
            const { hederaVaultRevertCases, owner } = await deployFixture();
            const amountToDeposit = 0;

            await expect(hederaVaultRevertCases.connect(owner).deposit(amountToDeposit, owner.address)).to.be.reverted;
        });
    });

    describe("mint", function () {
        it.only("Should mint tokens", async function () {
            const { hederaVault, owner, stakingToken } = await deployFixture();
            const amountOfShares = 1;

            const amount = await hederaVault.previewMint(amountOfShares);
            console.log("Preview Mint ", amount);

            await stakingToken.approve(hederaVault.target, amount);

            const tx = await hederaVault.connect(owner).mint(amountOfShares, owner.address, { gasLimit: 3000000 });

            console.log(tx.hash);

            await expect(tx)
                .to.emit(hederaVault, "Deposit")
                .withArgs(owner.address, owner.address, anyValue, amountOfShares);
        });
    });

    // The asset.safeTransfer from contract isn't presented
    describe("withdraw", function () {
        it.only("Should withdraw tokens", async function () {
            const { hederaVault, owner, sharesToken } = await deployFixture();
            const amountToWithdraw = 1;

            console.log("Preview Withdraw ", await hederaVault.previewWithdraw(amountToWithdraw));

            await sharesToken.approve(hederaVault.target, amountToWithdraw);

            const tx = await hederaVault.withdraw(amountToWithdraw, owner.address, owner.address, {
                gasLimit: 3000000,
            });

            console.log(tx.hash);

            await expect(tx)
                .to.emit(hederaVault, "Withdraw")
                .withArgs(owner.address, owner.address, amountToWithdraw, anyValue);
        });
    });

    describe("redeem", function () {
        it.only("Should redeem tokens", async function () {
            const { hederaVault, owner, stakingToken, sharesToken } = await deployFixture();
            const amountOfShares = 1;

            const tokensAmount = await hederaVault.previewRedeem(amountOfShares);
            console.log("Preview redeem ", tokensAmount);

            console.log("TOTAL SUPPLY ", await hederaVault.totalSupply());
            console.log("TOTAL ASSETS ", await hederaVault.totalAssets());
            console.log("TOTAL TOKENS ", await hederaVault.totalTokens());

            await stakingToken.approve(hederaVault.target, amountOfShares);

            const tx = await hederaVault
                .connect(owner)
                .redeem(amountOfShares, owner.address, owner.address, { gasLimit: 3000000 });

            console.log(tx.hash);

            await expect(tx)
                .to.emit(hederaVault, "Withdraw")
                .withArgs(owner.address, owner.address, tokensAmount, amountOfShares);
        });

        it.only("Should revert if zero assets", async function () {
            const { hederaVaultRevertCases, owner } = await deployFixture();
            const amountToReedem = 0;

            console.log(await hederaVaultRevertCases.previewRedeem(amountToReedem));

            await expect(
                hederaVaultRevertCases
                    .connect(owner)
                    .redeem(amountToReedem, owner.address, owner.address, { gasLimit: 3000000 }),
            ).to.be.reverted;
        });
    });

    describe("claimAllReward", function () {
        it.only("Should claim all pending rewards correctly", async function () {
            const { hederaVault, owner, rewardToken } = await deployFixture();
            const startPosition = 0;

            const rewardTokenInitialbalance = await rewardToken.balanceOf(owner.address);
            console.log(rewardTokenInitialbalance);

            // const userInfo = await hederaVault.userContribution(owner.address);
            // const lastClaimedAmount = await userInfo.lastClaimedAmountT(rewardToken.target);
            // console.log(lastClaimedAmount);

            //DEPOSITING REWARD TOKEN
            await rewardToken.approve(hederaVault.target, 3 * 1e8);
            const tx = await hederaVault.addReward(rewardToken.target, 3 * 1e8, {
                gasLimit: 3000000,
            });
            console.log(tx.hash);

            //DEPOSITING FUNDS TO VAULT
            const amountToDeposit = 500;
            console.log("Preview deposit ", await hederaVault.previewDeposit(amountToDeposit));
            const txDeposit = await hederaVault
                .connect(owner)
                .deposit(amountToDeposit, owner.address, { gasLimit: 3000000 });
            console.log(txDeposit.hash);

            // CLAIMING REWARDS
            const txClaim = await hederaVault.connect(owner).claimAllReward(startPosition, { gasLimit: 3000000 });
            console.log(txClaim.hash);

            console.log("Balance after ", (await rewardToken.balanceOf(owner.address)) - rewardTokenInitialbalance);
        });
    });
});
