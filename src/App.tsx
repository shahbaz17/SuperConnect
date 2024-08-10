import { useState, useEffect } from "react";
import { Web3AuthNoModal } from "@web3auth/no-modal";
import {
  WALLET_ADAPTERS,
  CHAIN_NAMESPACES,
  IProvider,
  WEB3AUTH_NETWORK,
  UX_MODE,
} from "@web3auth/base";
import { OpenloginAdapter } from "@web3auth/openlogin-adapter";
import { EthereumPrivateKeyProvider } from "@web3auth/ethereum-provider";
import { IDKitWidget, useIDKit, VerificationLevel } from "@worldcoin/idkit";
import {
  createWalletClient,
  createPublicClient,
  custom,
  formatEther,
  parseEther,
} from "viem";
import Logo from "./assets/super.connect-logo.png";
import "./App.css";
import { sepolia } from "viem/chains";

function App() {
  const { setOpen } = useIDKit();
  const [web3auth, setWeb3auth] = useState<Web3AuthNoModal | null>(null);
  const [provider, setProvider] = useState<IProvider | null>(null);
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [walletClient, setWalletClient] = useState<ReturnType<
    typeof createWalletClient
  > | null>(null);
  const [publicClient, setPublicClient] = useState<ReturnType<
    typeof createPublicClient
  > | null>(null);
  const [address, setAddress] = useState<`0x${string}` | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [recipientAddress, setRecipientAddress] = useState<string>("");
  const [amount, setAmount] = useState<string>("");

  useEffect(() => {
    const init = async () => {
      try {
        const chainConfig = {
          chainNamespace: CHAIN_NAMESPACES.EIP155,
          chainId: "0xaa36a7", // Sepolia chain ID, 0x4CF6 for SuperConnect Sepolia
          rpcTarget: "https://rpc.ankr.com/eth_sepolia",
          displayName: "Ethereum Sepolia Testnet",
          blockExplorerUrl: "https://sepolia.etherscan.io",
          ticker: "ETH",
          tickerName: "Ethereum",
          logo: "https://cryptologos.cc/logos/ethereum-eth-logo.png",
        };

        const privateKeyProvider = new EthereumPrivateKeyProvider({
          config: { chainConfig },
        });

        const web3auth = new Web3AuthNoModal({
          clientId:
            "BPi5PB_UiIZ-cPz1GtV5i1I2iOSOHuimiXBI0e-Oe_u6X3oVAbCiAZOTEBtTXw4tsluTITPqA8zMsfxIKMjiqNQ",
          web3AuthNetwork: WEB3AUTH_NETWORK.SAPPHIRE_MAINNET,
          privateKeyProvider,
        });

        const openloginAdapter = new OpenloginAdapter({
          adapterSettings: {
            uxMode: UX_MODE.REDIRECT,
            loginConfig: {
              jwt: {
                verifier: "w3a-worldcoin-demo",
                typeOfLogin: "jwt",
                clientId: "7u5jfJ3bakrfLBJYhyTquohpOth0Tmt7",
              },
            },
          },
        });
        web3auth.configureAdapter(openloginAdapter);
        setWeb3auth(web3auth);

        await web3auth.init();
        setProvider(web3auth.provider);

        const walletClient = createWalletClient({
          chain: sepolia,
          transport: custom(web3auth.provider!),
        });
        setWalletClient(walletClient);

        const publicClient = createPublicClient({
          chain: sepolia,
          transport: custom(web3auth.provider!),
        });
        setPublicClient(publicClient);

        if (web3auth.connected) {
          setLoggedIn(true);
          const address = await walletClient.getAddresses();
          setAddress(address[0]);
          const balance = await publicClient.getBalance({
            address: address[0],
          });
          setBalance(formatEther(balance));
        }
      } catch (error) {
        console.error(error);
      }
    };

    init();
  }, []);

  const uiConsole = (...args: unknown[]) => {
    const el = document.querySelector("#console>p");
    if (el) {
      el.innerHTML = JSON.stringify(args || {}, null, 2);
    }
  };

  const verifyProof = async (proof: unknown) => {
    console.log("proof", proof);
    const response = await fetch(
      "https://worldcoin-verify-proof-server.vercel.app/api/verify",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(proof),
      }
    );
    if (response.ok) {
      const { verified } = await response.json();
      return verified;
    } else {
      const { code, detail } = await response.json();
      throw new Error(`Error Code ${code}: ${detail}`);
    }
  };

  const onSuccess = async () => {
    console.log("Success");
    await sendTransaction();
  };

  const login = async () => {
    if (!web3auth) {
      uiConsole("web3auth not initialized yet");
      return;
    }
    const web3authProvider = await web3auth.connectTo(
      WALLET_ADAPTERS.OPENLOGIN,
      {
        loginProvider: "jwt",
        extraLoginOptions: {
          domain: "https://web3auth.jp.auth0.com",
          verifierIdField: "sub",
          connection: "worldcoin",
        },
      }
    );
    setProvider(web3authProvider);
  };

  const logout = async () => {
    if (!web3auth) {
      uiConsole("web3auth not initialized yet");
      return;
    }
    await web3auth.logout();
    setLoggedIn(false);
    setProvider(null);
  };

  const sendWithVerifyTransaction = async () => {
    if (amount <= "0.02") {
      await sendTransaction();
    } else {
      setOpen(true);
      console.log(
        "Opened World ID for verifying the user with World ID for bigger transaction"
      );
    }
  };

  const sendTransaction = async () => {
    if (!walletClient || !publicClient || !address) {
      uiConsole("Wallet not connected");
      return;
    }

    try {
      if (!provider) {
        throw new Error("Provider not initialized");
      }
      // For now using this, as their is an issue with the provider with vite when doing the sendTransaction
      const hash = await provider.request({
        method: "eth_sendTransaction",
        params: [
          {
            from: address,
            to: recipientAddress,
            gas: "0x5B8D80",
            value: parseEther(amount),
            data: "0x",
            gasPrice: "0x4a817c800",
          },
        ],
      });
      // Creating the anchor tag with the hash
      const explorerLink = `https://explorer-superconnect-kkwmx41xx2.t.conduit.xyz/tx/${hash}`;
      const anchor = `<a href="${explorerLink}" target="_blank">${hash}</a>`;
      const el = document.querySelector("#console>p");
      if (el) {
        el.innerHTML = `Transaction sent: ${anchor}`;
      }

      // TODO: Update with this code once the issue is resolved
      // const val = parseEther(amount);
      // const hash = await walletClient.sendTransaction({
      //   account: address,
      //   to: recipientAddress as `0x${string}`,
      //   value: BigInt(val) * BigInt(1e18),
      //   chain: sepolia,
      // });
      // console.log(hash);
      // const receipt = await publicClient.waitForTransactionReceipt({ hash });
      // uiConsole("Transaction sent", hash);
      return hash;
    } catch (error) {
      console.error("Transaction failed", error);
      uiConsole("Transaction failed", error);
    }
  };

  // View
  const loggedInView = (
    <>
      <div className="flex-container">
        <p>
          Hello WorldCoin User! you have {parseFloat(balance!).toFixed(3)} ETH
          in your{" "}
          <a
            href={`https://explorer-superconnect-kkwmx41xx2.t.conduit.xyz/address/${address}`}
            target="_blank"
          >
            {address}
          </a>{" "}
          wallet.
        </p>

        <div>
          <h2>Send Transaction</h2>
          <IDKitWidget
            app_id="app_staging_f3a97c0c7a87ffad90737c4cd149a763"
            action="verify-for-bigger-transaction"
            verification_level={VerificationLevel.Device}
            handleVerify={verifyProof}
            onSuccess={onSuccess}
          ></IDKitWidget>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendWithVerifyTransaction();
              setAmount("");
              setRecipientAddress("");
            }}
          >
            <input
              type="text"
              placeholder="Recipient Address"
              value={recipientAddress}
              onChange={(e) => setRecipientAddress(e.target.value)}
              required
              className="card"
            />
            <input
              type="number"
              placeholder="Amount (ETH)"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              className="card"
            />
            <button type="submit" className="card">
              Send
            </button>
          </form>
          <p className="info">
            When Sending more than 0.02 ETH, one needs to verify with WorldCoin
            Incognito Action before initiating the transaction
          </p>
        </div>
      </div>
      <div id="console" style={{ whiteSpace: "pre-line" }}>
        <p style={{ whiteSpace: "pre-line" }}></p>
      </div>
      <div>
        <button onClick={logout} className="card">
          Log Out
        </button>
      </div>
    </>
  );

  const loggedOutView = (
    <button onClick={login} className="card">
      Sign in with World ID
    </button>
  );

  return (
    <>
      <div>
        <img src={Logo} className="logo" alt="Super Connect logo" />
      </div>
      <h1>Super Connect Wallet</h1>
      <div className="grid">{loggedIn ? loggedInView : loggedOutView}</div>
      <p>
        <a
          href="https://github.com/SuperConnectHack/SuperConnect"
          target="_blank"
          className="vite-link"
        >
          Source code
        </a>
        <a
          href="https://simulator.worldcoin.org/id/0x14a219b1"
          target="_blank"
          className="vite-link"
        >
          WorldCoin Simulator
        </a>
      </p>
    </>
  );
}

export default App;
