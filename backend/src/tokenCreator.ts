import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  setAuthority,
  AuthorityType,
  TOKEN_PROGRAM_ID,
  getMint,
  getAccount
} from '@solana/spl-token';
import {
  createUmi,
  Umi,
  publicKey as umiPublicKey,
  keypairIdentity,
  generateSigner,
  signerIdentity,
  createSignerFromKeypair,
  some,
  createGenericFileFromBrowserFile, // For potential browser use later
  createGenericFile // For Node.js buffer use
} from '@metaplex-foundation/umi';
import { createBundlerUploader } from "@metaplex-foundation/umi-uploader-bundlr"; // Using bundlr alias for irys
import { mplTokenMetadata, createMetadataAccountV3, CreateMetadataAccountV3InstructionAccounts, CreateMetadataAccountV3InstructionDataArgs, TokenStandard, Collection, Uses } from '@metaplex-foundation/mpl-token-metadata';
import { createDefaults } from "@metaplex-foundation/umi-bundle-defaults";
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const RPC_ENDPOINT = process.env.RPC_ENDPOINT || 'https://api.devnet.solana.com';
const IRYS_NODE = process.env.IRYS_NODE || 'https://devnet.irys.xyz'; // Ensure this points to devnet

// --- Devnet Payer Setup ---
// IMPORTANT: This keypair is used to pay for transactions on devnet.
// It needs to be funded with devnet SOL.
// In a production environment, transactions would typically be signed and paid for
// by the user's connected wallet on the frontend.
const payer = Keypair.generate();
// --------------------------

let umi: Umi;
let connection: Connection;
let isInitialized = false;

async function initialize() {
  if (isInitialized) return;

  connection = new Connection(RPC_ENDPOINT, 'confirmed');

  // Log the payer public key so it can be funded
  console.log("--- DEVNET PAYER INFO ---");
  console.log(`Payer Public Key: ${payer.publicKey.toBase58()}`);
  console.log(`Attempting to airdrop 2 SOL to payer account...`);
  try {
      const airdropSignature = await connection.requestAirdrop(
          payer.publicKey,
          2 * LAMPORTS_PER_SOL // Request 2 SOL
      );
      await connection.confirmTransaction(airdropSignature, 'confirmed');
      console.log(`Airdrop successful. Signature: ${airdropSignature}`);
      const balance = await connection.getBalance(payer.publicKey);
      console.log(`Payer balance: ${balance / LAMPORTS_PER_SOL} SOL`);
  } catch (error) {
      console.error("Airdrop failed:", error);
      console.log(`Please fund this address manually with devnet SOL using:`);
      console.log(`solana airdrop 2 ${payer.publicKey.toBase58()} --url ${RPC_ENDPOINT}`);
  }
  console.log("-------------------------");

  // Initialize UMI
  umi = createUmi(RPC_ENDPOINT);
  umi.use(mplTokenMetadata());
  // Configure UMI to use the devnet payer keypair
  const payerUmiKeypair = umi.eddsa.createKeypairFromSecretKey(payer.secretKey);
  umi.use(keypairIdentity(payerUmiKeypair));
  // Configure Irys uploader
  umi.use(createBundlerUploader(umi, { address: IRYS_NODE })); // Use createBundlerUploader

  isInitialized = true;
  console.log("UMI and Connection initialized.");
}

// Call initialize on module load
initialize().catch(err => {
    console.error("Initialization failed:", err);
    process.exit(1); // Exit if initialization fails
});


async function uploadToArweave(umiInstance: Umi, data: Buffer, contentType: string, fileName: string): Promise<string> {
  try {
    const umiFile = createGenericFile(data, fileName, { contentType: contentType });

    console.log(`Uploading ${contentType} (${fileName}) to Arweave via Irys...`);
    const [uri] = await umiInstance.uploader.upload([umiFile]);
    console.log(`Successfully uploaded to Arweave. URI: ${uri}`);
    return uri;
  } catch (error) {
    console.error("Arweave upload failed:", error);
    throw new Error(`Failed to upload ${contentType} to Arweave: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function createMemeCoin(
  name: string,
  symbol: string,
  description: string,
  imageUrl: string,
  supply: number,
  decimals: number,
  creatorPublicKey: PublicKey
): Promise<{ mintAddress: string; tokenAccount: string; metadataUri: string; message: string }> {

  if (!isInitialized || !umi || !connection) {
      await initialize(); // Attempt re-initialization if needed
      if (!isInitialized) {
          throw new Error("Backend not initialized. Please wait and try again.");
      }
  }

  console.log(`Starting token creation for ${name} (${symbol})`);
  console.log(`Creator Public Key: ${creatorPublicKey.toBase58()}`);
  console.log(`Payer Public Key: ${payer.publicKey.toBase58()}`);

  // 1. Create Mint Account
  console.log("Creating mint account...");
  const mintKeypair = Keypair.generate(); // Generate keypair for the mint account itself
  const mint = mintKeypair.publicKey;
  console.log(`New Mint Public Key: ${mint.toBase58()}`);

  const lamports = await connection.getMinimumBalanceForRentExemption(82); // 82 bytes for mint account state

  const transaction = new Transaction().add(
      SystemProgram.createAccount({
          fromPubkey: payer.publicKey,
          newAccountPubkey: mint,
          space: 82,
          lamports,
          programId: TOKEN_PROGRAM_ID,
      }),
      // Initialize the mint account
      // Note: We use createInitializeMintInstruction from @solana/spl-token directly if needed,
      // but createMint handles this internally. Using createMint is simpler.
  );

   // Using createMint helper which handles createAccount and initializeMint
   await createMint(
    connection,
    payer,                // Payer of the transaction fees
    creatorPublicKey,     // Mint Authority (user's wallet)
    creatorPublicKey,     // Freeze Authority (user's wallet)
    decimals,             // Decimals
    mintKeypair,          // Keypair for the mint account
    { commitment: 'confirmed' },
    TOKEN_PROGRAM_ID
  );
  console.log(`Mint account created: ${mint.toBase58()}`);


  // 2. Create Associated Token Account (ATA) for the creator
  console.log("Creating associated token account...");
  const creatorTokenAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    payer,                // Payer
    mint,                 // Mint public key
    creatorPublicKey,     // Owner of the ATA
    false,                // Allow owner off curve
    'confirmed'
  );
  console.log(`Associated token account created: ${creatorTokenAccount.address.toBase58()}`);

  // 3. Mint the total supply to the creator's ATA
  console.log(`Minting ${supply} tokens (considering ${decimals} decimals) to creator's ATA...`);
  const amountToMint = BigInt(supply) * BigInt(10 ** decimals);
  await mintTo(
    connection,
    payer,                // Payer
    mint,                 // Mint public key
    creatorTokenAccount.address, // Destination ATA
    creatorPublicKey,     // Minting authority (currently the creator)
    amountToMint,         // Amount to mint (considering decimals)
    [],                   // Signers (Mint Authority is creatorPublicKey, payer signs the tx)
    { commitment: 'confirmed' }
  );
  console.log("Tokens minted successfully.");

  // 4. Upload Image and Metadata to Arweave via Irys
  console.log("Downloading image...");
  let imageBuffer: Buffer;
  let contentType: string | undefined;
  let imageFileName = 'image'; // Default filename
  try {
    const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    imageBuffer = Buffer.from(response.data);
    contentType = response.headers['content-type'];
    if (!contentType || !contentType.startsWith('image/')) {
        throw new Error('Invalid content type. URL must point to an image.');
    }
    const extension = contentType.split('/')[1];
    if (extension) {
        imageFileName = `image.${extension}`; // e.g., image.png
    }
    console.log(`Image downloaded successfully (${contentType}). Size: ${imageBuffer.length} bytes`);
  } catch (error: any) {
    console.error("Failed to download image:", error);
    throw new Error(`Failed to download image from URL: ${error.message}`);
  }

  const imageUri = await uploadToArweave(umi, imageBuffer, contentType, imageFileName);
  console.log(`Image uploaded to Arweave: ${imageUri}`);

  const metadata = {
    name: name,
    symbol: symbol,
    description: description,
    image: imageUri,
    // Optional: Add external_url or attributes if needed
    // external_url: "https://yourwebsite.com",
    // attributes: [ { "trait_type": "Coolness", "value": "Very" } ]
  };
  const metadataJson = JSON.stringify(metadata);
  const metadataBuffer = Buffer.from(metadataJson, 'utf-8');
  const metadataUri = await uploadToArweave(umi, metadataBuffer, 'application/json', 'metadata.json');
  console.log(`Metadata JSON uploaded to Arweave: ${metadataUri}`);


  // 5. Create and Attach Metadata using Metaplex UMI
  console.log("Creating and attaching metadata using Metaplex UMI...");
  const umiMintPublicKey = umiPublicKey(mint.toBase58());
  // The creatorPublicKey is the authority, but the backend's payer keypair signs and pays.
  // UMI needs a Signer representation of the authority. Since the backend *controls* the authority
  // at this stage (it holds the creatorPublicKey), we create a signer using the *payer's* keypair
  // but associate it with the creator's public key for the instruction's account requirements.
  // This is specific to this backend-controlled flow. In a frontend-only flow, the user's wallet would sign.
   const authoritySigner = createSignerFromKeypair(umi, {publicKey: umiPublicKey(creatorPublicKey.toBase58()), secretKey: payer.secretKey});

  await createMetadataAccountV3(umi, {
      mint: umiMintPublicKey,
      mintAuthority: authoritySigner, // The user's wallet is the authority
      payer: umi.identity, // Backend payer pays for this tx
      updateAuthority: umiPublicKey(creatorPublicKey.toBase58()), // User's wallet is the update authority initially
      data: {
          name: name,
          symbol: symbol,
          uri: metadataUri,
          sellerFeeBasisPoints: 0, // Typically 0 for meme coins
          creators: null, // Not needed for fungible tokens
          collection: null, // Not part of an NFT collection
          uses: null, // Not applicable for fungible tokens
      },
      isMutable: true, // Start as mutable to allow revoking update authority later if desired
      collectionDetails: null, // Not an NFT
  }).sendAndConfirm(umi, { confirm: { commitment: 'confirmed' } });

  console.log("Metadata account created successfully.");


  // 6. Revoke Mint Authority
  console.log("Revoking mint authority...");
  try {
    await setAuthority(
      connection,
      payer,                // Payer signs and pays
      mint,                 // Mint account
      creatorPublicKey,     // Current authority (user's wallet)
      AuthorityType.MintTokens, // Authority type to revoke
      null,               // New authority (null to revoke)
      [],                 // No extra signers needed, creatorPublicKey is the authority, payer signs tx
      { commitment: 'confirmed' }
    );
    // Verification
    const updatedMintInfo = await getMint(connection, mint, 'confirmed');
    if (updatedMintInfo.mintAuthority !== null) {
        console.warn("Mint authority revocation may not have completed successfully (check explorer).");
        // Consider throwing an error if strict verification is needed
    } else {
        console.log("Mint authority revoked successfully.");
    }
  } catch (error) {
      console.error("Failed to revoke mint authority:", error);
      throw new Error(`Failed to revoke mint authority: ${error instanceof Error ? error.message : String(error)}`);
  }


  // 7. Revoke Freeze Authority
  console.log("Revoking freeze authority...");
   try {
    await setAuthority(
      connection,
      payer,                // Payer signs and pays
      mint,                 // Mint account
      creatorPublicKey,     // Current authority (user's wallet)
      AuthorityType.FreezeAccount, // Authority type to revoke
      null,               // New authority (null to revoke)
      [],                 // No extra signers needed
      { commitment: 'confirmed' }
    );
     // Verification
    const updatedMintInfoAfterFreezeRevoke = await getMint(connection, mint, 'confirmed');
    if (updatedMintInfoAfterFreezeRevoke.freezeAuthority !== null) {
        console.warn("Freeze authority revocation may not have completed successfully (check explorer).");
        // Consider throwing an error if strict verification is needed
    } else {
        console.log("Freeze authority revoked successfully.");
    }
  } catch (error) {
      console.error("Failed to revoke freeze authority:", error);
      throw new Error(`Failed to revoke freeze authority: ${error instanceof Error ? error.message : String(error)}`);
  }

  // Optional: Revoke Metadata Update Authority (make metadata immutable)
  // This requires the update authority (creatorPublicKey) to sign.
  // In this backend setup, we use the authoritySigner again.
  console.log("Making metadata immutable (revoking update authority)...");
  try {
      await createMetadataAccountV3(umi, { // Use V3 again for update
          metadata: mplTokenMetadata.pda(umi, { mint: umiMintPublicKey }), // Find PDA
          mint: umiMintPublicKey,
          updateAuthority: authoritySigner, // User's wallet (signed by payer in this backend context)
          payer: umi.identity, // Payer pays
          data: { // Provide existing data again
              name: name,
              symbol: symbol,
              uri: metadataUri,
              sellerFeeBasisPoints: 0,
              creators: null,
              collection: null,
              uses: null,
          },
          newUpdateAuthority: umiPublicKey('11111111111111111111111111111111'), // Set to system program or null equivalent if API allows
          primarySaleHappened: null, // Don't change
          isMutable: false, // Set to immutable
          collectionDetails: null, // Not changing
      }).sendAndConfirm(umi, { confirm: { commitment: 'confirmed' } });
      console.log("Metadata update authority revoked (metadata is now immutable).");
  } catch (error) {
      console.error("Failed to make metadata immutable:", error);
      // Don't throw error here, as the main process succeeded, but log it.
      console.warn("Could not revoke metadata update authority. Metadata might remain mutable.");
  }


  console.log("Token creation process completed.");

  return {
    mintAddress: mint.toBase58(),
    tokenAccount: creatorTokenAccount.address.toBase58(),
    metadataUri: metadataUri,
    message: "Token created, mint/freeze authorities revoked successfully."
  };
}
