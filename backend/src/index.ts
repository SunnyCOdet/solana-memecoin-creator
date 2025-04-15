import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createMemeCoin } from './tokenCreator';
import { PublicKey } from '@solana/web3.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors()); // Enable CORS for all origins
app.use(express.json()); // Parse JSON request bodies

// Routes
app.get('/', (req: Request, res: Response) => {
  res.send('Solana Meme Coin Creator Backend');
});

app.post('/api/create-token', async (req: Request, res: Response) => {
  const { name, symbol, description, imageUrl, supply, decimals, creatorPublicKey } = req.body;

  // Basic Input Validation
  if (!name || !symbol || !description || !imageUrl || supply === undefined || decimals === undefined || !creatorPublicKey) {
    return res.status(400).json({ success: false, error: 'Missing required fields.' });
  }
  if (typeof name !== 'string' || name.length === 0 || name.length > 32) { // Added length check
    return res.status(400).json({ success: false, error: 'Invalid name (max 32 chars).' });
  }
  if (typeof symbol !== 'string' || symbol.length === 0 || symbol.length > 10) { // Added length check
    return res.status(400).json({ success: false, error: 'Invalid symbol (max 10 chars).' });
  }
  if (typeof description !== 'string') {
    return res.status(400).json({ success: false, error: 'Invalid description.' });
  }
  try {
    const parsedUrl = new URL(imageUrl);
     // Basic check for image extension (can be improved) - case insensitive
     if (!/\.(jpg|jpeg|png|gif|svg|webp)$/i.test(parsedUrl.pathname)) {
        return res.status(400).json({ success: false, error: 'Image URL must end with a valid image extension (jpg, png, gif, svg, webp).' });
     }
  } catch (_) {
    return res.status(400).json({ success: false, error: 'Invalid image URL format.' });
  }
  if (typeof supply !== 'number' || supply <= 0 || !Number.isInteger(supply)) {
    return res.status(400).json({ success: false, error: 'Supply must be a positive integer.' });
  }
   if (typeof decimals !== 'number' || decimals < 0 || decimals > 9 || !Number.isInteger(decimals)) {
    return res.status(400).json({ success: false, error: 'Decimals must be an integer between 0 and 9.' });
  }
  let creatorPubKey: PublicKey;
  try {
    creatorPubKey = new PublicKey(creatorPublicKey);
  } catch (error) {
    return res.status(400).json({ success: false, error: 'Invalid creator public key.' });
  }

  try {
    console.log(`Received request to create token: ${name} (${symbol}) for ${creatorPublicKey}`);
    const result = await createMemeCoin(
      name,
      symbol,
      description,
      imageUrl,
      supply,
      decimals,
      creatorPubKey
    );
    console.log(`Token creation successful: ${result.mintAddress}`);
    res.status(200).json({ success: true, ...result });
  } catch (error: any) {
    console.error('Token creation failed:', error);
    // Try to extract a more specific error message
    const errorMessage = error.message || (error.logs ? error.logs.join('\n') : 'Failed to create token.');
    res.status(500).json({ success: false, error: errorMessage });
  }
});

// Start Server
app.listen(port, () => {
  console.log(`Backend server running at http://localhost:${port}`);
  console.log(`Using RPC endpoint: ${process.env.RPC_ENDPOINT}`);
  console.log(`Using Irys node: ${process.env.IRYS_NODE}`);
  // The payer keypair is generated in tokenCreator.ts - its public key will be logged there.
});
