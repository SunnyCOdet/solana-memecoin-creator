import React, { useState, useEffect, useCallback } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import axios from 'axios';
import './App.css'; // Ensure CSS is imported

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000'; // Use env var or default

function App() {
  const { connection } = useConnection();
  const { publicKey, connected } = useWallet();

  const [name, setName] = useState('');
  const [symbol, setSymbol] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [supply, setSupply] = useState<number | ''>('');
  const [decimals, setDecimals] = useState<number | ''>(9); // Default to 9 decimals
  const [creatorPublicKey, setCreatorPublicKey] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<{ mintAddress: string; tokenAccount: string; metadataUri: string; message: string } | null>(null);

  // Update creatorPublicKey when wallet connects/disconnects
  useEffect(() => {
    if (connected && publicKey) {
      setCreatorPublicKey(publicKey.toBase58());
    } else {
      setCreatorPublicKey('');
    }
  }, [connected, publicKey]);

  const validateUrl = (url: string): boolean => {
    try {
      const parsedUrl = new URL(url);
      // Basic check for image extension (can be improved) - case insensitive
      return /\.(jpg|jpeg|png|gif|svg|webp)$/i.test(parsedUrl.pathname);
    } catch (_) {
      return false;
    }
  };

  const handleSubmit = useCallback(async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccessInfo(null);

    if (!connected || !publicKey) {
      setError('Please connect your wallet first.');
      return;
    }

    if (!name || !symbol || !description || !imageUrl || supply === '' || decimals === '') {
      setError('Please fill in all fields.');
      return;
    }
     if (name.length > 32) {
        setError('Token Name cannot exceed 32 characters.');
        return;
    }
    if (symbol.length > 10) {
        setError('Symbol cannot exceed 10 characters.');
        return;
    }

    if (!validateUrl(imageUrl)) {
      setError('Please enter a valid image URL ending with .jpg, .png, .gif, .svg, or .webp.');
      return;
    }

     if (supply <= 0 || !Number.isInteger(supply)) {
      setError('Supply must be a positive whole number.');
      return;
    }

    if (decimals < 0 || decimals > 9 || !Number.isInteger(decimals)) {
        setError('Decimals must be a whole number between 0 and 9.');
        return;
    }


    setIsLoading(true);

    try {
      console.log("Sending request to backend:", {
        name,
        symbol,
        description,
        imageUrl,
        supply: Number(supply),
        decimals: Number(decimals),
        creatorPublicKey: publicKey.toBase58(),
      });
      const response = await axios.post(`${BACKEND_URL}/api/create-token`, {
        name,
        symbol,
        description,
        imageUrl,
        supply: Number(supply),
        decimals: Number(decimals),
        creatorPublicKey: publicKey.toBase58(),
      });

      console.log("Backend response:", response.data);

      if (response.data.success) {
        setSuccessInfo(response.data);
        // Optionally clear form
        // setName(''); setSymbol(''); setDescription(''); setImageUrl(''); setSupply(''); setDecimals(9);
      } else {
        setError(response.data.error || 'An unknown error occurred.');
      }
    } catch (err: any) {
      console.error("API call failed:", err);
      const errorMsg = err.response?.data?.error || err.message || 'Failed to communicate with the backend.';
      // Make Solana logs more readable if present
      const formattedError = errorMsg.includes("Program log:") ? errorMsg.split("Program log:").join("\nProgram log:") : errorMsg;
      setError(formattedError);
    } finally {
      setIsLoading(false);
    }
  }, [name, symbol, description, imageUrl, supply, decimals, connected, publicKey, connection]); // Removed connection dependency as it's not directly used here

  return (
    <div className="container">
      <header className="header">
        <h1>Solana Meme Coin Creator (Devnet)</h1>
        <WalletMultiButton />
      </header>

      <main className="main-content">
        <form onSubmit={handleSubmit} className="token-form">
          <h2>Create Your Meme Coin</h2>

          <div className="form-group">
            <label htmlFor="name">Token Name:</label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Doge With Hat (Max 32 chars)"
              required
              maxLength={32} // Enforce limit
            />
          </div>

          <div className="form-group">
            <label htmlFor="symbol">Symbol:</label>
            <input
              id="symbol"
              type="text"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              placeholder="e.g., DWH (Max 10 chars)"
              required
              maxLength={10} // Enforce limit
            />
          </div>

          <div className="form-group">
            <label htmlFor="description">Description:</label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your legendary meme coin"
              rows={3}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="imageUrl">Image URL:</label>
            <input
              id="imageUrl"
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://example.com/image.png"
              required
            />
             <small>Must be a direct link to a JPG, PNG, GIF, SVG, or WEBP image.</small>
          </div>

          <div className="form-group">
            <label htmlFor="supply">Total Supply:</label>
            <input
              id="supply"
              type="number"
              value={supply}
               onChange={(e) => setSupply(e.target.value === '' ? '' : parseInt(e.target.value))}
              placeholder="e.g., 1000000000"
              required
              min="1"
              step="1"
            />
             <small>The total number of tokens to exist.</small>
          </div>

          <div className="form-group">
            <label htmlFor="decimals">Decimals:</label>
            <input
              id="decimals"
              type="number"
              value={decimals}
              onChange={(e) => setDecimals(e.target.value === '' ? '' : parseInt(e.target.value))}
              required
              min="0"
              max="9"
              step="1"
            />
             <small>Defines the smallest unit (0-9). e.g., 9 means 1 token = 1,000,000,000 smallest units. Usually 6 or 9.</small>
          </div>

          <div className="form-group">
            <label htmlFor="creatorPublicKey">Creator Wallet (You):</label>
            <input
              id="creatorPublicKey"
              type="text"
              value={creatorPublicKey}
              readOnly
              placeholder="Connect wallet to populate"
              className="readonly-input"
            />
             <small>Your connected wallet address. This will be the initial owner and authority.</small>
          </div>

          <button type="submit" disabled={isLoading || !connected}>
            {isLoading ? 'Creating Token...' : 'Create Meme Coin'}
          </button>

          {error && <pre className="message error-message">Error: {error}</pre>}

          {successInfo && (
            <div className="message success-message">
              <p><strong>Success! {successInfo.message}</strong></p>
              <p><strong>Mint Address:</strong> {successInfo.mintAddress}</p>
              <p><strong>Your Token Account:</strong> {successInfo.tokenAccount}</p>
              <p><strong>Metadata URI:</strong> <a href={successInfo.metadataUri} target="_blank" rel="noopener noreferrer">{successInfo.metadataUri}</a></p>
              <p>View on Solana Explorer (Devnet):</p>
              <p><a href={`https://explorer.solana.com/address/${successInfo.mintAddress}?cluster=devnet`} target="_blank" rel="noopener noreferrer">View Mint</a></p>
               <p><a href={`https://explorer.solana.com/address/${successInfo.tokenAccount}?cluster=devnet`} target="_blank" rel="noopener noreferrer">View Token Account</a></p>
               <p><small>It might take a minute for the explorer to update.</small></p>
            </div>
          )}
        </form>
         <div className="important-notes">
            <h3>Important Notes (Devnet Only)</h3>
            <ul>
                <li>This tool operates on the <strong>Solana Devnet</strong>. Tokens created have no real value.</li>
                <li>The backend uses a temporary payer wallet which needs <strong>Devnet SOL</strong> for transaction fees. It attempts to airdrop SOL automatically on startup, but this may fail. Check the backend console logs for the payer address if manual funding is needed (`solana airdrop 2 [PAYER_ADDRESS] --url https://api.devnet.solana.com`).</li>
                <li>Ensure your connected wallet (e.g., Phantom) is also set to <strong>Devnet</strong>.</li>
                <li>Metadata and images are uploaded to <strong>Arweave via Irys (Devnet)</strong>.</li>
                <li>Minting and Freeze authorities are <strong>revoked</strong> after creation. Metadata is made <strong>immutable</strong>.</li>
            </ul>
        </div>
      </main>
    </div>
  );
}

export default App;
