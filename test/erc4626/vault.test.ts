import { anyValue, ethers, expect } from "../setup";
import {
    TokenTransfer,
    createFungibleToken,
    TokenBalance,
    createAccount,
    addToken,
    mintToken,
} from "../../scripts/utils";
import { PrivateKey, Client, AccountId, TokenAssociateTransaction, AccountBalanceQuery } from "@hashgraph/sdk";
import hre from "hardhat";

// constants
// const stakingTokenId = "0.0.3757626";
// const sharesTokenAddress = "0x0000000000000000000000000000000000395640";
// const revertCasesVaultAddress = "0xb3C24B140BA2a69099276e55dE1885e93517C6C6";
// const revertCasesVaultId = "0.0.3757631";
// const newStakingTokenId = "0.0.4229238";
// const newVaultAddress = "0x26767C096B669b0A5Df59efeF0d6CbA3840E47F6"
// const newRewardTokenId = "0.0.4229229";
// const rewardTokenAddress = "0x000000000000000000000000000000000040886d";
// const newSharesTokenAddress = "0x0000000000000000000000000000000000408879";
// const newSharesTokenId = "0.0.4229241";
// const newVaultId = "0.0.4229240";
// const vaultEr = "0x8b594f719e36cc1bbf08a24b3edbcf50cdeecae6";

const vaultEr = "0x23fb7ae562afb6df92b937240482d7ad694ae57b";
const newSharesTokenAddress = "0x000000000000000000000000000000000040a0a9";
const rewardTokenAddress = "0x7FD142464518cf1725EF3DFe3A288A6E294722d2";
// Tests
describe("Vault", function () {
    async function deployFixture() {
        const [owner] = await ethers.getSigners();

        let client = Client.forTestnet();

        const operatorPrKey = PrivateKey.fromStringECDSA(process.env.PRIVATE_KEY || "");
        const operatorAccountId = AccountId.fromString(process.env.ACCOUNT_ID || "");
        // const stAccountId = AccountId.fromString("0.0.2673429");

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

        // const sharesTokenAssociate = await new TokenAssociateTransaction()
        //     .setAccountId(operatorAccountId)
        //     .setTokenIds([newSharesTokenId])
        //     .execute(client);

        // const stakingTokenAssociate = await new TokenAssociateTransaction()
        //     .setAccountId(operatorAccountId)
        //     .setTokenIds([newStakingTokenId])
        //     .execute(client);

        // const rewardTokenAssociate = await new TokenAssociateTransaction()
        //     .setAccountId(operatorAccountId)
        //     .setTokenIds([newRewardTokenId])
        //     .execute(client);

        const hederaVaultRevertCases = await ethers.getContractAt("HederaVault", vaultEr);
        const hederaVault = await ethers.getContractAt("HederaVault", vaultEr);

        const rewardToken = await ethers.getContractAt(erc20.abi, rewardTokenAddress);

        const stakingToken = await ethers.getContractAt(erc20.abi, await hederaVault.asset());

        const sharesToken = await ethers.getContractAt(erc20.abi, newSharesTokenAddress);

        // await TokenTransfer(newStakingTokenId, operatorAccountId, stAccountId, 10, client);

        // const stakingTokenOperatorBalance = await (
        //     await TokenBalance(operatorAccountId, client)
        // ).tokens!.get(newStakingTokenId);
        // console.log("Staking token balance: ", stakingTokenOperatorBalance.toString());

        // const tx = await rewardToken.approve(hederaVault.target, 100);

        // const rewTx = await hederaVault.addReward(rewardTokenAddress, 100, { gasLimit: 3000000 });

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
            const { hederaVault, owner, stakingToken, rewardToken } = await deployFixture();
            const amountToDeposit = 3;

            console.log("Preview deposit ", await hederaVault.previewDeposit(amountToDeposit));

            // await rewardToken.approve(hederaVault.target, 3 * 1e8);

            // const tx = await hederaVault.addReward(rewardTokenAddress, 3 * 1e8, { gasLimit: 3000000, value: ethers.parseUnits("5", 18) });
            // console.log(tx.hash);

            // console.log("TOTAL TOKENS", (await hederaVault.rewardsAddress(rewardTokenAddress)).amount);

            await stakingToken.approve(hederaVault.target, amountToDeposit);

            const tx = await hederaVault.connect(owner).deposit(amountToDeposit, owner.address, { gasLimit: 3000000 });

            console.log(tx.hash);

            // await expect(tx)
            //     .to.emit(hederaVault, "Deposit")
            //     .withArgs(owner.address, owner.address, amountToDeposit, anyValue);
        });

        it("Should revert if zero shares", async function () {
            const { hederaVaultRevertCases, owner } = await deployFixture();
            const amountToDeposit = 0;

            await expect(hederaVaultRevertCases.connect(owner).deposit(amountToDeposit, owner.address)).to.be.reverted;
        });
    });

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

    describe("mint", function () {
        it("Should mint tokens", async function () {
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

    describe("redeem", function () {
        // it("Should redeem tokens", async function () {
        //     const { hederaVault, owner, stakingToken, sharesToken } = await deployFixture();
        //     const amountOfShares = 1;

        //     const tokensAmount = await hederaVault.previewRedeem(amountOfShares);
        //     console.log("Preview redeem ", tokensAmount);

        //     console.log("TOTAL SUPPLY", await hederaVault.totalSupply());
        //     console.log("TOTAL ASSETS", await hederaVault.totalAssets());
        //     console.log("TOTAL TOKENS", await hederaVault.totalTokens());

        // await stakingToken.approve(hederaVault.target, amountOfShares);

        // const tx = await hederaVault.connect(owner).redeem(
        //     amountOfShares,
        //     owner.address,
        //     owner.address,
        //     { gasLimit: 3000000 }
        // );

        // console.log(tx.hash);

        // await expect(
        //     tx
        // ).to.emit(hederaVault, "Withdraw")
        //     .withArgs(owner.address, owner.address, tokensAmount, amountOfShares);
        // });

        it("Should revert if zero assets", async function () {
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
});
