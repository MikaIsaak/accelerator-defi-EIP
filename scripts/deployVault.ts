import { ethers } from "hardhat";
import * as dotenv from "dotenv";
import { createFungibleToken } from "../scripts/utils";
import { Client, AccountId, PrivateKey } from "@hashgraph/sdk";

dotenv.config();

async function main() {
    const [deployer] = await ethers.getSigners();
    const network = await ethers.provider.getNetwork();

    console.log("Deploying contract with account:", deployer.address, "at:", network.name);

    let client = Client.forTestnet();

    const operatorPrKey = PrivateKey.fromStringECDSA(process.env.PRIVATE_KEY || "");
    const operatorAccountId = AccountId.fromString(process.env.ACCOUNT_ID || "");

    client.setOperator(operatorAccountId, operatorPrKey);

    const stakingToken = await createFungibleToken(
        "ERC4626 on Hedera",
        "HERC4626",
        process.env.ACCOUNT_ID,
        operatorPrKey.publicKey,
        client,
        operatorPrKey,
    );

    const stakingTokenAddress = "0x" + stakingToken!.toSolidityAddress();

    const HederaVault = await ethers.getContractFactory("HederaVault");
    const hederaVault = await HederaVault.deploy(stakingTokenAddress, "TST", "TST", {
        from: deployer.address,
        gasLimit: 3000000,
        value: ethers.parseUnits("14", 18),
    });
    console.log("Hash ", hederaVault.deploymentTransaction()?.hash);
    await hederaVault.waitForDeployment();

    console.log("Vault deployed with address: ", await hederaVault.getAddress());
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
