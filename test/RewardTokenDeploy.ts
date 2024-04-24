import { Client, PrivateKey, AccountId, TokenCreateTransaction, TokenType, TokenSupplyType } from "@hashgraph/sdk";

async function createFungibleToken(
    tokenName: any,
    tokenSymbol: any,
    treasuryAccountId: any,
    supplyPublicKey: any,
    client: any,
    privateKey: any,
) {
    // Create the transaction and freeze for manual signing
    const tokenCreateTx = new TokenCreateTransaction()
        .setTokenName(tokenName)
        .setTokenSymbol(tokenSymbol)
        .setDecimals(8)
        .setInitialSupply(1000 * 1e8)
        .setTreasuryAccountId(treasuryAccountId)
        .setTokenType(TokenType.FungibleCommon)
        .setSupplyType(TokenSupplyType.Infinite)
        .setSupplyKey(supplyPublicKey);

    // Optionally, manually set the transaction ID if needed
    // tokenCreateTx.setTransactionId(TransactionId.generate(treasuryAccountId));

    // Freeze the transaction with the client
    tokenCreateTx.freezeWith(client);

    // Sign the transaction with the private key of the treasury account
    const signTx = await tokenCreateTx.sign(privateKey);

    // Execute the transaction
    const submitTx = await signTx.execute(client);

    // Fetch the receipt of the transaction
    const receipt = await submitTx.getReceipt(client);
    console.log(`The token ID is: ${receipt.tokenId}`);
    return receipt.tokenId;
}

async function main() {
    const operatorPrivateKey = PrivateKey.fromStringECDSA(process.env.PRIVATE_KEY || "");
    const treasuryAccountId = AccountId.fromString(process.env.ACCOUNT_ID || "");
    const client = Client.forTestnet();
    client.setOperator(treasuryAccountId, operatorPrivateKey);

    // Create a new fungible token
    const tokenId = await createFungibleToken(
        "Reward Token 1",
        "RT1",
        treasuryAccountId,
        operatorPrivateKey.publicKey,
        client,
        operatorPrivateKey,
    );
    console.log("Token created with ID:", tokenId?.toString());
    console.log("Address ", tokenId?.toSolidityAddress());
}

main().catch(console.error);
