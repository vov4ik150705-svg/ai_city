// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {MerkleRoots} from "../src/MerkleRoots.sol";
import {PrizeTreasury} from "../src/PrizeTreasury.sol";
import {StakeRegistry} from "../src/StakeRegistry.sol";
import {Vault} from "../src/Vault.sol";
import {PackConstants} from "../test/PackConstants.sol";

/// Four groups after launchToken. Token from env. No buy. DESIGN.md §10, D-P-14.
interface Vm {
    function envAddress(string calldata k) external view returns (address);
    function envUint(string calldata k) external view returns (uint256);
    function startBroadcast() external;
    function stopBroadcast() external;
}

contract PlayerReady {
    Vm internal constant vm = Vm(address(uint160(0x7109709ECfa91a80626fF3989D68f67F5b1DD12D)));

    event Deployed(address vault, address stake, address roots, address prizes);

    function run() external {
        address corp = vm.envAddress("CORPORATOR_CORP_TOKEN");
        address minter = vm.envAddress("CORPORATOR_VAULT_MINTER");
        address house = vm.envAddress("CORPORATOR_VAULT_HOUSE");
        address voucher = vm.envAddress("CORPORATOR_VOUCHER_SIGNER");
        address guardian = vm.envAddress("CORPORATOR_GUARDIAN");
        address signer = vm.envAddress("CORPORATOR_SIGNER");
        address stakeOwner = vm.envAddress("CORPORATOR_STAKE_OWNER");
        address attestor = vm.envAddress("CORPORATOR_ATTESTOR");
        address depositor = vm.envAddress("CORPORATOR_BUYBACK_EXECUTOR");
        address[] memory stocks = new address[](6);
        stocks[0] = vm.envAddress("CORPORATOR_STOCK_NVDA");
        stocks[1] = vm.envAddress("CORPORATOR_STOCK_TSLA");
        stocks[2] = vm.envAddress("CORPORATOR_STOCK_AMZN");
        stocks[3] = vm.envAddress("CORPORATOR_STOCK_AAPL");
        stocks[4] = vm.envAddress("CORPORATOR_STOCK_MSFT");
        stocks[5] = vm.envAddress("CORPORATOR_STOCK_COIN");
        require(PackConstants.LAUNCH_BUY_SHARE_BPS == 0, "buy");
        require(guardian != signer, "roles");
        vm.startBroadcast();
        Vault vault = new Vault(
            corp,
            minter,
            voucher,
            guardian,
            signer,
            PackConstants.CAPITAL_ANCHOR,
            PackConstants.VOUCHER_TTL_S,
            house
        );
        StakeRegistry stake = new StakeRegistry(stakeOwner, vm.envUint("CORPORATOR_UNSTAKE_COOLDOWN_S"));
        MerkleRoots roots = new MerkleRoots(attestor);
        PrizeTreasury prizes = new PrizeTreasury(depositor, guardian, signer, stocks);
        vm.stopBroadcast();
        emit Deployed(address(vault), address(stake), address(roots), address(prizes));
    }
}
