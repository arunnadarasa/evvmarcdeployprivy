import {
  decodeFunctionResult,
  encodeFunctionData,
  getContractAddress,
  type Abi,
  type PublicClient,
  type Hash,
  type Address,
} from 'viem';
import {
  StakingABI,
  NameServiceABI,
  EstimatorABI,
  P2PSwapABI,
} from '@evvm/viem-signature-library';
import {
  STAKING_BYTECODE,
  EVVM_CORE_BYTECODE,
  CORE_HASH_UTILS_BYTECODE,
  EVVM_CORE_LINK_REFERENCES,
  NAME_SERVICE_BYTECODE,
  ESTIMATOR_BYTECODE,
  TREASURY_BYTECODE,
  P2P_SWAP_BYTECODE,
} from './bytecodes';
import { arcTestnet, sepolia } from '@/lib/wagmi';

const REGISTRY_EVM_SEPOLIA_ADDRESS =
  '0x389dC8fb09211bbDA841D59f4a51160dA2377832' as Address;

const ARC_TESTNET_CHAIN_ID = arcTestnet.id as typeof arcTestnet.id;

type DeploymentWalletClient = {
  account?:
    | {
        address: Address;
        encodeDeployCallData?: (parameters: {
          abi: Abi;
          bytecode: `0x${string}`;
          args: readonly unknown[];
        }) => Promise<`0x${string}`>;
      }
    | undefined;
  chain?: { id: number } | undefined;
  deployContract?: (parameters: Record<string, unknown>) => Promise<Hash>;
  sendTransaction?: (parameters: Record<string, unknown>) => Promise<Hash>;
  writeContract: (parameters: Record<string, unknown>) => Promise<Hash>;
};

type DeploymentClients = {
  arcWalletClient: DeploymentWalletClient;
  arcPublicClient: PublicClient;
  sepoliaWalletClient: DeploymentWalletClient;
  sepoliaPublicClient: PublicClient;
};

const RegistryEvvmABI = [
  {
    type: 'function',
    name: 'registerEvvm',
    inputs: [
      { name: 'hostChainId', type: 'uint256', internalType: 'uint256' },
      { name: 'evvmAddress', type: 'address', internalType: 'address' },
    ],
    outputs: [{ name: 'evvmId', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'nonpayable',
  },
] as const;

export type DeploymentStage =
  | 'idle'
  | 'deploying-staking'
  | 'deploying-core'
  | 'deploying-nameservice'
  | 'deploying-estimator'
  | 'initializing-staking'
  | 'initializing-core'
  | 'deploying-treasury'
  | 'deploying-p2pswap'
  | 'deployment-complete'
  | 'switching-to-sepolia'
  | 'registering'
  | 'switching-back'
  | 'configuring-evvm-id'
  | 'complete'
  | 'failed';

export interface DeploymentProgress {
  stage: DeploymentStage;
  message: string;
  txHash?: string;
  step: number;
  totalSteps: number;
}

export interface DeploymentConfig {
  adminAddress: Address;
  goldenFisherAddress: Address;
  activatorAddress: Address;
  evvmName: string;
  principalTokenName: string;
  principalTokenSymbol: string;
  totalSupply: bigint;
  eraTokens: bigint;
  rewardPerOperation: bigint;
}

export interface ContractAddresses {
  staking?: Address;
  evvmCore?: Address;
  nameService?: Address;
  estimator?: Address;
  treasury?: Address;
  p2pSwap?: Address;
  evvmId?: bigint;
}

const CoreABI = [
  {
    type: 'constructor',
    inputs: [
      { name: '_initialOwner', type: 'address', internalType: 'address' },
      {
        name: '_stakingContractAddress',
        type: 'address',
        internalType: 'address',
      },
      {
        name: '_evvmMetadata',
        type: 'tuple',
        internalType: 'struct CoreStructs.EvvmMetadata',
        components: [
          { name: 'EvvmName', type: 'string', internalType: 'string' },
          { name: 'EvvmID', type: 'uint256', internalType: 'uint256' },
          { name: 'principalTokenName', type: 'string', internalType: 'string' },
          { name: 'principalTokenSymbol', type: 'string', internalType: 'string' },
          { name: 'principalTokenAddress', type: 'address', internalType: 'address' },
          { name: 'totalSupply', type: 'uint256', internalType: 'uint256' },
          { name: 'eraTokens', type: 'uint256', internalType: 'uint256' },
          { name: 'reward', type: 'uint256', internalType: 'uint256' },
        ],
      },
    ],
    stateMutability: 'nonpayable',
  },
] as const;

const TreasuryABI = [
  {
    type: 'constructor',
    inputs: [{ name: '_coreAddress', type: 'address', internalType: 'address' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'getCoreAddress',
    inputs: [],
    outputs: [{ name: '', type: 'address', internalType: 'address' }],
    stateMutability: 'view',
  },
] as const;

const StakingInitializeSystemContractsABI = [
  {
    type: 'function',
    name: 'initializeSystemContracts',
    inputs: [
      { name: '_estimator', type: 'address', internalType: 'address' },
      { name: '_core', type: 'address', internalType: 'address' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const;

const CoreInitializeSystemContractsABI = [
  {
    type: 'function',
    name: 'initializeSystemContracts',
    inputs: [
      { name: '_nameServiceAddress', type: 'address', internalType: 'address' },
      { name: '_treasuryAddress', type: 'address', internalType: 'address' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const;

async function waitForReceiptOrThrow(
  publicClient: PublicClient,
  hash: Hash,
  label: string,
  timeout: number = 120_000
) {
  try {
    return await publicClient.waitForTransactionReceipt({
      hash,
      timeout,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown receipt error';
    throw new Error(
      `${label} was submitted (${hash.slice(0, 10)}...${hash.slice(-8)}) but no receipt was confirmed within ${Math.round(timeout / 1000)}s. ${message}`
    );
  }
}

async function deployContractWithRetry(
  walletClient: DeploymentWalletClient,
  publicClient: PublicClient,
  params: { abi: Abi; bytecode: `0x${string}`; args: readonly unknown[] },
  onPreparing?: () => void,
  onSubmitted?: (hash: Hash) => void,
  maxRetries: number = 3
): Promise<{ address: Address; txHash: Hash }> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const deployer = walletClient.account?.address;
      if (!deployer) {
        throw new Error('Missing deployment account');
      }

      onPreparing?.();

      const deployNonce = await publicClient.getTransactionCount({
        address: deployer,
        blockTag: 'latest',
      });

      let hash: Hash;
      if (walletClient.deployContract) {
        hash = await walletClient.deployContract({
          abi: params.abi,
          bytecode: params.bytecode,
          args: params.args,
          account: deployer,
          chain: walletClient.chain,
        });
      } else if (
        walletClient.sendTransaction &&
        walletClient.account?.encodeDeployCallData
      ) {
        const callData = await walletClient.account.encodeDeployCallData({
          abi: params.abi,
          bytecode: params.bytecode,
          args: params.args,
        });

        hash = await walletClient.sendTransaction({
          account: walletClient.account,
          chain: walletClient.chain,
          callData,
        });
      } else {
        throw new Error('Wallet client cannot deploy contracts');
      }

      onSubmitted?.(hash);

      const receipt = await waitForReceiptOrThrow(
        publicClient,
        hash,
        'Deployment transaction'
      );

      if (receipt.status === 'reverted') {
        throw new Error('Deployment transaction reverted');
      }

      const contractAddress =
        receipt.contractAddress ??
        getContractAddress({
          from: deployer,
          nonce: deployNonce,
        });

      // Some non-standard testnet RPCs can lag on `eth_getCode` even when receipts already succeeded.
      // Arc Testnet can be slightly eventual here, so we allow receipt success to be authoritative.
      const shouldVerifyBytecode = walletClient.chain?.id !== ARC_TESTNET_CHAIN_ID;
      if (shouldVerifyBytecode) {
        // Verify bytecode exists (some RPCs lag right after mining).
        let code: `0x${string}` | undefined;
        for (let i = 0; i < 8; i++) {
          // Some RPC providers reject eth_getCode(address, blockNumber) as "invalid params".
          // We poll "latest" instead to confirm the contract shows up.
          code = await publicClient.getCode({ address: contractAddress });
          if (code && code !== '0x') break;
          await new Promise((r) => setTimeout(r, 500 * (i + 1)));
        }
        if (!code || code === '0x') {
          throw new Error('Contract bytecode verification failed (RPC may be lagging)');
        }
      }

      return { address: contractAddress, txHash: hash };
    } catch (error) {
      if (attempt >= maxRetries) throw error;
      await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1000));
    }
  }
  throw new Error('Deployment failed after retries');
}

function linkBytecode(
  bytecode: `0x${string}`,
  libraryAddress: Address,
  refs: Array<{ start: number; length: number }>
): `0x${string}` {
  const addr = libraryAddress.toLowerCase().replace(/^0x/, '');
  if (addr.length !== 40) {
    throw new Error(`Invalid library address length: ${libraryAddress}`);
  }

  let hex = bytecode.replace(/^0x/, '');
  for (const { start, length } of refs) {
    const offset = start * 2;
    const replaceLen = length * 2;
    hex = hex.slice(0, offset) + addr + hex.slice(offset + replaceLen);
  }
  return `0x${hex}` as `0x${string}`;
}

export async function deployEVVMContracts(
  config: DeploymentConfig,
  clients: DeploymentClients,
  onProgress: (progress: DeploymentProgress) => void
): Promise<ContractAddresses> {
  const addresses: ContractAddresses = {};
  const totalSteps = 9;
  const { arcWalletClient, arcPublicClient, sepoliaWalletClient, sepoliaPublicClient } = clients;

  // Step 1: Deploy Staking
  onProgress({ stage: 'deploying-staking', message: 'Deploying Staking contract...', step: 1, totalSteps });
  const staking = await deployContractWithRetry(arcWalletClient, arcPublicClient, {
    abi: StakingABI,
    bytecode: STAKING_BYTECODE,
    args: [config.adminAddress, config.goldenFisherAddress],
  }, () => {
    onProgress({
      stage: 'deploying-staking',
      message: 'Preparing Staking deployment in Privy wallet...',
      step: 1,
      totalSteps,
    });
  }, (hash) => {
    onProgress({
      stage: 'deploying-staking',
      message: 'Staking deployment submitted. Waiting for Arc receipt...',
      txHash: hash,
      step: 1,
      totalSteps,
    });
  });
  addresses.staking = staking.address;
  onProgress({ stage: 'deploying-staking', message: 'Staking deployed', txHash: staking.txHash, step: 1, totalSteps });

  // Step 2: Deploy EVVM Core
  onProgress({ stage: 'deploying-core', message: 'Deploying EVVM Core contract...', step: 2, totalSteps });
  const evvmMetadata = {
    EvvmName: config.evvmName,
    EvvmID: 0n,
    principalTokenName: config.principalTokenName,
    principalTokenSymbol: config.principalTokenSymbol,
    // Matches EVVM's BaseInputs.sol placeholder (0x...01).
    principalTokenAddress: '0x0000000000000000000000000000000000000001' as Address,
    totalSupply: config.totalSupply,
    eraTokens: config.eraTokens,
    reward: config.rewardPerOperation,
  } as const;

  // Core bytecode needs linking for CoreHashUtils (Solidity library).
  const linkReferences = EVVM_CORE_LINK_REFERENCES as Record<
    string,
    Record<string, Array<{ start: number; length: number }>>
  >;
  const coreHashUtilsRefs =
    linkReferences['src/library/utils/signature/CoreHashUtils.sol']?.CoreHashUtils ?? [];

  if (coreHashUtilsRefs.length === 0) {
    throw new Error('Missing CoreHashUtils link references for Core bytecode');
  }

  onProgress({ stage: 'deploying-core', message: 'Deploying CoreHashUtils library...', step: 2, totalSteps });
  const coreHashUtils = await deployContractWithRetry(arcWalletClient, arcPublicClient, {
    abi: [],
    bytecode: CORE_HASH_UTILS_BYTECODE,
    args: [],
  }, () => {
    onProgress({
      stage: 'deploying-core',
      message: 'Preparing CoreHashUtils deployment in Privy wallet...',
      step: 2,
      totalSteps,
    });
  }, (hash) => {
    onProgress({
      stage: 'deploying-core',
      message: 'CoreHashUtils deployment submitted. Waiting for Arc receipt...',
      txHash: hash,
      step: 2,
      totalSteps,
    });
  });

  const linkedCoreBytecode = linkBytecode(
    EVVM_CORE_BYTECODE,
    coreHashUtils.address,
    coreHashUtilsRefs
  );

  const core = await deployContractWithRetry(arcWalletClient, arcPublicClient, {
    abi: CoreABI,
    bytecode: linkedCoreBytecode,
    args: [config.adminAddress, addresses.staking, evvmMetadata],
  }, () => {
    onProgress({
      stage: 'deploying-core',
      message: 'Preparing EVVM Core deployment in Privy wallet...',
      step: 2,
      totalSteps,
    });
  }, (hash) => {
    onProgress({
      stage: 'deploying-core',
      message: 'EVVM Core deployment submitted. Waiting for Arc receipt...',
      txHash: hash,
      step: 2,
      totalSteps,
    });
  });
  addresses.evvmCore = core.address;
  onProgress({ stage: 'deploying-core', message: 'EVVM Core deployed', txHash: core.txHash, step: 2, totalSteps });

  // Step 3: Deploy Estimator
  onProgress({ stage: 'deploying-estimator', message: 'Deploying Estimator contract...', step: 3, totalSteps });
  const estimator = await deployContractWithRetry(arcWalletClient, arcPublicClient, {
    abi: EstimatorABI,
    bytecode: ESTIMATOR_BYTECODE,
    args: [config.activatorAddress, addresses.evvmCore, addresses.staking, config.adminAddress],
  }, () => {
    onProgress({
      stage: 'deploying-estimator',
      message: 'Preparing Estimator deployment in Privy wallet...',
      step: 3,
      totalSteps,
    });
  }, (hash) => {
    onProgress({
      stage: 'deploying-estimator',
      message: 'Estimator deployment submitted. Waiting for Arc receipt...',
      txHash: hash,
      step: 3,
      totalSteps,
    });
  });
  addresses.estimator = estimator.address;
  onProgress({ stage: 'deploying-estimator', message: 'Estimator deployed', txHash: estimator.txHash, step: 3, totalSteps });

  // Step 4: Deploy NameService
  onProgress({ stage: 'deploying-nameservice', message: 'Deploying NameService contract...', step: 4, totalSteps });
  const nameService = await deployContractWithRetry(arcWalletClient, arcPublicClient, {
    abi: NameServiceABI,
    bytecode: NAME_SERVICE_BYTECODE,
    args: [addresses.evvmCore, config.adminAddress],
  }, () => {
    onProgress({
      stage: 'deploying-nameservice',
      message: 'Preparing NameService deployment in Privy wallet...',
      step: 4,
      totalSteps,
    });
  }, (hash) => {
    onProgress({
      stage: 'deploying-nameservice',
      message: 'NameService deployment submitted. Waiting for Arc receipt...',
      txHash: hash,
      step: 4,
      totalSteps,
    });
  });
  addresses.nameService = nameService.address;
  onProgress({ stage: 'deploying-nameservice', message: 'NameService deployed', txHash: nameService.txHash, step: 4, totalSteps });

  // Step 5: staking.initializeSystemContracts(estimator, core)
  onProgress({ stage: 'initializing-staking', message: 'Initializing Staking system contracts...', step: 5, totalSteps });
  onProgress({
    stage: 'initializing-staking',
    message: 'Preparing Staking initialization in Privy wallet...',
    step: 5,
    totalSteps,
  });
  const initStakingTxHash = await arcWalletClient.writeContract({
    address: addresses.staking!,
    abi: StakingInitializeSystemContractsABI,
    functionName: 'initializeSystemContracts',
    args: [addresses.estimator!, addresses.evvmCore!],
    account: arcWalletClient.account!.address,
    chain: arcWalletClient.chain,
  });
  onProgress({
    stage: 'initializing-staking',
    message: 'Staking initialization submitted. Waiting for Arc receipt...',
    txHash: initStakingTxHash,
    step: 5,
    totalSteps,
  });
  const initStakingReceipt = await waitForReceiptOrThrow(
    arcPublicClient,
    initStakingTxHash,
    'Staking initialization transaction'
  );
  if (initStakingReceipt.status === 'reverted') {
    throw new Error('Staking initializeSystemContracts transaction reverted');
  }
  onProgress({
    stage: 'initializing-staking',
    message: 'Staking initialized',
    txHash: initStakingTxHash,
    step: 5,
    totalSteps,
  });

  // Step 6: Deploy Treasury
  onProgress({ stage: 'deploying-treasury', message: 'Deploying Treasury contract...', step: 6, totalSteps });
  const treasury = await deployContractWithRetry(arcWalletClient, arcPublicClient, {
    abi: TreasuryABI,
    bytecode: TREASURY_BYTECODE,
    args: [addresses.evvmCore],
  }, () => {
    onProgress({
      stage: 'deploying-treasury',
      message: 'Preparing Treasury deployment in Privy wallet...',
      step: 6,
      totalSteps,
    });
  }, (hash) => {
    onProgress({
      stage: 'deploying-treasury',
      message: 'Treasury deployment submitted. Waiting for Arc receipt...',
      txHash: hash,
      step: 6,
      totalSteps,
    });
  });
  addresses.treasury = treasury.address;
  onProgress({ stage: 'deploying-treasury', message: 'Treasury deployed', txHash: treasury.txHash, step: 6, totalSteps });

  // Step 7: core.initializeSystemContracts(nameService, treasury)
  onProgress({ stage: 'initializing-core', message: 'Initializing Core system contracts...', step: 7, totalSteps });
  onProgress({
    stage: 'initializing-core',
    message: 'Preparing Core initialization in Privy wallet...',
    step: 7,
    totalSteps,
  });
  const initCoreTxHash = await arcWalletClient.writeContract({
    address: addresses.evvmCore!,
    abi: CoreInitializeSystemContractsABI,
    functionName: 'initializeSystemContracts',
    args: [addresses.nameService!, addresses.treasury!],
    account: arcWalletClient.account!.address,
    chain: arcWalletClient.chain,
  });
  onProgress({
    stage: 'initializing-core',
    message: 'Core initialization submitted. Waiting for Arc receipt...',
    txHash: initCoreTxHash,
    step: 7,
    totalSteps,
  });
  const initCoreReceipt = await waitForReceiptOrThrow(
    arcPublicClient,
    initCoreTxHash,
    'Core initialization transaction'
  );
  if (initCoreReceipt.status === 'reverted') {
    throw new Error('Core initializeSystemContracts transaction reverted');
  }
  onProgress({
    stage: 'initializing-core',
    message: 'Core initialized',
    txHash: initCoreTxHash,
    step: 7,
    totalSteps,
  });

  // Step 8: Deploy P2PSwap
  onProgress({ stage: 'deploying-p2pswap', message: 'Deploying P2PSwap contract...', step: 8, totalSteps });
  const p2pSwap = await deployContractWithRetry(arcWalletClient, arcPublicClient, {
    abi: P2PSwapABI,
    bytecode: P2P_SWAP_BYTECODE,
    args: [addresses.evvmCore, addresses.staking, config.adminAddress],
  }, () => {
    onProgress({
      stage: 'deploying-p2pswap',
      message: 'Preparing P2PSwap deployment in Privy wallet...',
      step: 8,
      totalSteps,
    });
  }, (hash) => {
    onProgress({
      stage: 'deploying-p2pswap',
      message: 'P2PSwap deployment submitted. Waiting for Arc receipt...',
      txHash: hash,
      step: 8,
      totalSteps,
    });
  });
  addresses.p2pSwap = p2pSwap.address;
  onProgress({ stage: 'deploying-p2pswap', message: 'P2PSwap deployed', txHash: p2pSwap.txHash, step: 8, totalSteps });

  // Step 9: Register EVVM on Ethereum Sepolia Registry
  const hostChainId = arcWalletClient.chain?.id ?? ARC_TESTNET_CHAIN_ID;
  onProgress({ stage: 'switching-to-sepolia', message: 'Preparing ZeroDev smart account on Ethereum Sepolia...', step: 9, totalSteps });

  onProgress({ stage: 'registering', message: 'Registering EVVM instance on Sepolia registry...', step: 9, totalSteps });
  const registerCalldata = encodeFunctionData({
    abi: RegistryEvvmABI,
    functionName: 'registerEvvm',
    args: [BigInt(hostChainId), addresses.evvmCore],
  });
  const predictedRegisterResult = await sepoliaPublicClient.call({
    account: sepoliaWalletClient.account!.address,
    to: REGISTRY_EVM_SEPOLIA_ADDRESS,
    data: registerCalldata,
  });

  const evvmId = decodeFunctionResult({
    abi: RegistryEvvmABI,
    functionName: 'registerEvvm',
    data: predictedRegisterResult.data,
  });
  const regTxHash = await sepoliaWalletClient.sendTransaction({
    account: sepoliaWalletClient.account,
    to: REGISTRY_EVM_SEPOLIA_ADDRESS,
    data: registerCalldata,
    chain: sepolia,
  });
  onProgress({
    stage: 'registering',
    message: 'Sepolia registration submitted. Waiting for receipt...',
    txHash: regTxHash,
    step: 9,
    totalSteps,
  });

  const regReceipt = await waitForReceiptOrThrow(
    sepoliaPublicClient,
    regTxHash,
    'Sepolia registration transaction'
  );
  if (regReceipt.status === 'reverted') {
    throw new Error('Registry registration transaction reverted');
  }

  addresses.evvmId = evvmId;
  onProgress({
    stage: 'registering',
    message: `EVVM registered on Sepolia (ID: ${evvmId.toString()})`,
    txHash: regTxHash,
    step: 9,
    totalSteps,
  });

  onProgress({ stage: 'switching-back', message: 'Returning to Arc deployment context...', step: 9, totalSteps });

  onProgress({ stage: 'deployment-complete', message: 'All contracts deployed and registered!', step: 9, totalSteps });

  return addresses;
}
