import React, { FC, ReactNode, useMemo } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets'; // Add other wallets like Solflare if needed
import { clusterApiUrl } from '@solana/web3.js';

// Default styles that can be overridden by your app's CSS
// Make sure this is imported AFTER your own App.css if you want to override easily
require('@solana/wallet-adapter-react-ui/styles.css');

const WalletContextProvider: FC<{ children: ReactNode }> = ({ children }) => {
    // Can be set to 'devnet', 'testnet', or 'mainnet-beta'
    // Ensure this matches the backend RPC endpoint setting
    const network = WalletAdapterNetwork.Devnet;

    // You can also provide a custom RPC endpoint. Recommended to match backend.
    const endpoint = useMemo(() => process.env.NEXT_PUBLIC_RPC_ENDPOINT || clusterApiUrl(network), [network]);
    // const endpoint = useMemo(() => 'https://api.devnet.solana.com', []); // Or hardcode if preferred

    // @solana/wallet-adapter-wallets includes all the adapters but supports tree shaking --
    // Only the wallets you configure here will be compiled into your application
    const wallets = useMemo(
        () => [
            new PhantomWalletAdapter(),
            new SolflareWalletAdapter({ network }),
            // Add other wallets like:
            // new TorusWalletAdapter(),
            // new LedgerWalletAdapter(),
        ],
        [network] // Re-create adapters if network changes (though it's fixed here)
    );

    return (
        <ConnectionProvider endpoint={endpoint}>
            <WalletProvider wallets={wallets} autoConnect>
                <WalletModalProvider>
                    {children}
                </WalletModalProvider>
            </WalletProvider>
        </ConnectionProvider>
    );
};

export default WalletContextProvider;
