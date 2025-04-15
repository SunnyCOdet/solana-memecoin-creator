# Solana Meme Coin Creator (Devnet)

This project allows users to create their own SPL tokens (meme coins) on the Solana Devnet using a simple web interface. It handles token creation, metadata upload to Arweave (via Irys), and revokes mint/freeze authorities.

## Tech Stack

*   **Frontend:** React, Vite, TypeScript, Solana Wallet Adapter, Axios
*   **Backend:** Node.js, Express, TypeScript, Solana Web3.js, SPL Token, Metaplex UMI (for metadata & Irys upload), Axios, Dotenv
*   **Blockchain:** Solana (Devnet)
*   **Metadata Storage:** Arweave (via Irys Devnet)

## Project Structure

```
/home/project
├── backend/
│   ├── src/
│   │   ├── index.ts        # Express server setup, API endpoint
│   │   └── tokenCreator.ts # Core logic for SPL token/metadata creation
│   ├── .env.example    # Environment variable template
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── App.tsx         # Main React component with the form
│   │   ├── main.tsx        # Entry point, WalletProvider setup
│   │   ├── WalletContextProvider.tsx # Configures Solana Wallet Adapter
│   │   └── App.css         # Basic styling
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   ├── tsconfig.node.json
│   └── vite.config.js  # Vite configuration with polyfills
├── .gitignore
└── README.md
```

## Setup and Running

**Prerequisites:**

*   Node.js (v18 or later recommended)
*   npm or yarn
*   A Solana wallet browser extension (like Phantom or Solflare) set to **Devnet**.

**Steps:**

1.  **Clone the Repository (if applicable):**
    ```bash
    # git clone ...
    # cd solana-meme-creator
    ```

2.  **Install Dependencies:**
    Install dependencies for both the backend and frontend.
    ```bash
    cd backend
    npm install
    cd ../frontend
    npm install
    cd ..
    ```

3.  **Configure Backend Environment:**
    *   Navigate to the `backend` directory.
    *   Copy `.env.example` to a new file named `.env`.
        ```bash
        cp backend/.env.example backend/.env
        ```
    *   Review the variables in `backend/.env`. The defaults for `RPC_ENDPOINT` (Solana Devnet) and `IRYS_NODE` (Irys Devnet) are usually sufficient. You can change the `PORT` if needed.

4.  **Fund the Backend Payer Wallet (IMPORTANT):**
    *   The backend uses a *temporary, randomly generated* keypair to pay for transaction fees on the Devnet (creating the mint, minting tokens, creating metadata, revoking authority).
    *   When you start the backend (next step), it will log the **Public Key** of this temporary payer wallet to the console and attempt to airdrop 2 Devnet SOL to it.
    *   **If the automatic airdrop fails**, you MUST manually fund this address using the Solana CLI:
        ```bash
        # Replace YOUR_PAYER_PUBLIC_KEY with the key logged by the backend
        solana airdrop 2 YOUR_PAYER_PUBLIC_KEY --url https://api.devnet.solana.com
        ```
    *   You might need to run the airdrop command a couple of times if the network is busy. Verify the balance with `solana balance YOUR_PAYER_PUBLIC_KEY --url https://api.devnet.solana.com`.

5.  **Run the Backend:**
    *   Open a terminal in the `backend` directory.
    *   Start the development server:
        ```bash
        npm run dev
        ```
    *   Keep this terminal running. Note the payer public key logged here for funding if needed.

6.  **Run the Frontend:**
    *   Open a *separate* terminal in the `frontend` directory.
    *   Start the Vite development server:
        ```bash
        npm run dev
        ```
    *   Vite will output a local URL (usually `http://localhost:3000` or similar).

7.  **Use the Application:**
    *   Open the frontend URL in your browser.
    *   Ensure your browser wallet (Phantom/Solflare) is connected and set to **Devnet**.
    *   Connect your wallet using the "Select Wallet" button.
    *   Fill in the token details (Name, Symbol, Description, Image URL, Supply, Decimals).
    *   Click "Create Meme Coin".
    *   Approve the transactions in your wallet when prompted (although in this setup, the backend payer handles most fees, the frontend might initiate certain actions requiring user signature in future versions or different configurations).
    *   Wait for the process to complete. Success or error messages will be displayed.

## How it Works

1.  **Frontend:** User fills the form and submits. The connected wallet's public key is sent along with the form data to the backend.
2.  **Backend API:** Receives the request, validates input.
3.  **Token Creation (`tokenCreator.ts`):**
    *   Uses the backend's funded payer keypair to pay for transactions.
    *   Uses the user's public key (`creatorPublicKey`) as the Mint Authority and Freeze Authority initially.
    *   Creates the Mint Account (`createMint`).
    *   Creates an Associated Token Account (ATA) for the user (`getOrCreateAssociatedTokenAccount`).
    *   Mints the total supply to the user's ATA (`mintTo`).
    *   Downloads the image from the provided URL.
    *   Uploads the image to Arweave via Irys (`umi.uploader.upload`).
    *   Constructs JSON metadata including the Arweave image URI.
    *   Uploads the JSON metadata to Arweave via Irys (`umi.uploader.upload`).
    *   Creates the Metaplex Metadata Account linked to the mint, using the user's public key as the update authority (`createMetadataAccountV3`). The backend payer signs this transaction, authorized by holding the user's public key *in this specific backend flow*.
    *   Revokes the Mint Authority (`setAuthority` with `null`).
    *   Revokes the Freeze Authority (`setAuthority` with `null`).
    *   Makes the metadata immutable by setting the update authority to a system address (`createMetadataAccountV3` update).
4.  **Backend API:** Sends the results (mint address, ATA, metadata URI) or error back to the frontend.
5.  **Frontend:** Displays the success information (including links to the Solana Explorer) or the error message.

## Important Considerations (Devnet)

*   **Devnet Only:** All tokens and transactions are on the Solana Devnet and have no real-world value.
*   **Backend Payer:** The backend payer keypair is crucial. Ensure it has enough Devnet SOL. It's generated ephemerally on each backend start in this example. For persistent use, load a keypair from a file or environment variable securely.
*   **Security:** This example uses a backend payer for simplicity. In a production scenario, you'd typically have the user's wallet sign and pay for most transactions directly from the frontend to avoid the backend needing excessive permissions or funds.
*   **Error Handling:** Basic error handling is included, but robust production applications would need more comprehensive checks and user feedback.
*   **Rate Limits:** Devnet RPC endpoints and Irys nodes might have rate limits.
