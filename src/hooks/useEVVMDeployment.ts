import { useCallback, useState } from 'react';
import {
  deployEVVMContracts,
  type DeploymentConfig,
  type DeploymentProgress,
  type ContractAddresses,
} from '@/lib/contracts/deployment';
import { hasBytecodes } from '@/lib/contracts/bytecodes';
import {
  saveDeployment,
  generateId,
  type DeploymentRecord,
} from '@/lib/storage';
import { arcTestnet, getChainName, getPublicClient, sepolia } from '@/lib/wagmi';
import { useAppWallet } from '@/hooks/useAppWallet';

const DEPLOYMENT_STEP_COUNT = 9;

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Deployment failed';
}

export function useEVVMDeployment() {
  const [deploying, setDeploying] = useState(false);
  const [progress, setProgress] = useState<DeploymentProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const {
    eoaAddress,
    isConnected,
    getEoaWalletClient,
    getSmartAccountClient,
    switchChain,
  } = useAppWallet();

  const canDeploy = isConnected && !!eoaAddress && hasBytecodes();

  const deploy = useCallback(
    async (config: DeploymentConfig): Promise<DeploymentRecord | null> => {
      if (!eoaAddress) {
        setError('Wallet not connected');
        return null;
      }

      setDeploying(true);
      setError(null);

      const deploymentId = generateId();
      const record: DeploymentRecord = {
        id: deploymentId,
        createdAt: new Date().toISOString(),
        evvmName: config.evvmName,
        principalTokenName: config.principalTokenName,
        principalTokenSymbol: config.principalTokenSymbol,
        hostChainId: arcTestnet.id,
        hostChainName: getChainName(arcTestnet.id),
        adminAddress: config.adminAddress,
        goldenFisherAddress: config.goldenFisherAddress,
        activatorAddress: config.activatorAddress,
        deploymentStatus: 'deploying',
        currentStep: 0,
        txHashes: {},
        totalSupply: config.totalSupply.toString(),
        eraTokens: config.eraTokens.toString(),
        rewardPerOperation: config.rewardPerOperation.toString(),
      };

      saveDeployment(record);

      try {
        await switchChain(arcTestnet.id);
        const arcWalletClient = await getEoaWalletClient(arcTestnet.id);
        const sepoliaWalletClient = await getSmartAccountClient(sepolia.id);
        await switchChain(arcTestnet.id);

        const addresses: ContractAddresses = await deployEVVMContracts(
          config,
          {
            arcWalletClient,
            arcPublicClient: getPublicClient(arcTestnet.id),
            sepoliaWalletClient,
            sepoliaPublicClient: getPublicClient(sepolia.id),
          },
          (p) => {
            setProgress(p);
            record.currentStep = p.step;
            if (p.txHash) {
              record.txHashes[p.stage] = p.txHash;
            }
            saveDeployment(record);
          }
        );

        record.stakingAddress = addresses.staking;
        record.evvmCoreAddress = addresses.evvmCore;
        record.nameServiceAddress = addresses.nameService;
        record.estimatorAddress = addresses.estimator;
        record.treasuryAddress = addresses.treasury;
        record.p2pSwapAddress = addresses.p2pSwap;
        if (addresses.evvmId !== undefined) {
          record.evvmId = Number(addresses.evvmId);
        }
        record.deploymentStatus = 'completed';
        record.currentStep = DEPLOYMENT_STEP_COUNT;
        saveDeployment(record);

        setProgress({
          stage: 'complete',
          message: 'Deployment complete!',
          step: DEPLOYMENT_STEP_COUNT,
          totalSteps: DEPLOYMENT_STEP_COUNT,
        });

        await switchChain(arcTestnet.id);

        return record;
      } catch (err) {
        const message = getErrorMessage(err);
        record.deploymentStatus = 'failed';
        saveDeployment(record);
        setError(message);
        setProgress({
          stage: 'failed',
          message,
          step: record.currentStep,
          totalSteps: DEPLOYMENT_STEP_COUNT,
        });
        return null;
      } finally {
        setDeploying(false);
      }
    },
    [eoaAddress, getEoaWalletClient, getSmartAccountClient, switchChain]
  );

  return { deploying, progress, error, canDeploy, deploy };
}
