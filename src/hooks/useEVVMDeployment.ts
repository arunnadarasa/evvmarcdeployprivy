import { useState, useCallback } from 'react';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
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
import { getChainName } from '@/lib/wagmi';

export function useEVVMDeployment() {
  const [deploying, setDeploying] = useState(false);
  const [progress, setProgress] = useState<DeploymentProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { address, chain } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();

  const canDeploy = !!address && !!walletClient && !!publicClient && hasBytecodes();

  const deploy = useCallback(
    async (config: DeploymentConfig): Promise<DeploymentRecord | null> => {
      if (!walletClient || !publicClient || !chain) {
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
        hostChainId: chain.id,
        hostChainName: getChainName(chain.id),
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
        const addresses: ContractAddresses = await deployEVVMContracts(
          config,
          walletClient,
          publicClient,
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
        record.currentStep = 7;
        saveDeployment(record);

        setProgress({
          stage: 'complete',
          message: 'Deployment complete!',
          step: 7,
          totalSteps: 7,
        });

        return record;
      } catch (err: any) {
        record.deploymentStatus = 'failed';
        saveDeployment(record);
        setError(err?.message || 'Deployment failed');
        setProgress({
          stage: 'failed',
          message: err?.message || 'Deployment failed',
          step: record.currentStep,
          totalSteps: 7,
        });
        return null;
      } finally {
        setDeploying(false);
      }
    },
    [walletClient, publicClient, chain]
  );

  return { deploying, progress, error, canDeploy, deploy };
}
