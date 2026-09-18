// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {CorpToken} from "../src/CorpToken.sol";
import {Vault} from "../src/Vault.sol";
import {PrizeTreasury} from "../src/PrizeTreasury.sol";
import {StakeRegistry} from "../src/StakeRegistry.sol";
import {PackConstants} from "./PackConstants.sol";

interface Vm {
    function prank(address) external;
    function startPrank(address) external;
    function stopPrank() external;
    function warp(uint256) external;
    function expectRevert() external;
    function addr(uint256) external returns (address);
}

/// Fee-on-transfer stock with six decimals. PLAN_RELEASE P3 A-P-10 / A-P-11.
contract FeeStock {
    uint8 public constant decimals = 6;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        uint256 fee = amount / 10;
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount - fee;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        require(allowed >= amount, "allowance");
        allowance[from][msg.sender] = allowed - amount;
        uint256 fee = amount / 10;
        balanceOf[from] -= amount;
        balanceOf[to] += amount - fee;
        return true;
    }
}

contract P3AuditTest {
    Vm internal constant vm = Vm(address(uint160(0x7109709ECfa91a80626fF3989D68f67F5b1DD12D)));

    CorpToken internal corp;
    CorpToken internal nvda;
    FeeStock internal fee;
    Vault internal vault;
    PrizeTreasury internal prizes;
    StakeRegistry internal stakes;
    address internal player;
    address internal bot;
    address internal guardian;
    address internal safetySigner;

    function setUp() public {
        player = vm.addr(1);
        bot = vm.addr(2);
        guardian = vm.addr(3);
        safetySigner = vm.addr(4);
        corp = new CorpToken(PackConstants.CREATOR_TAX_BPS, address(this), 1000);
        nvda = new CorpToken(0, address(this), 0);
        fee = new FeeStock();
        vault = new Vault(
            address(corp),
            address(this),
            address(this),
            guardian,
            safetySigner,
            PackConstants.CAPITAL_ANCHOR,
            PackConstants.VOUCHER_TTL_S
        );
        address[] memory stocks = new address[](6);
        stocks[0] = address(nvda);
        stocks[1] = address(fee);
        stocks[2] = address(uint160(0x102));
        stocks[3] = address(uint160(0x103));
        stocks[4] = address(uint160(0x104));
        stocks[5] = address(uint160(0x105));
        prizes = new PrizeTreasury(bot, guardian, safetySigner, stocks);
        stakes = new StakeRegistry(address(this));
        stakes.setToken("NVDA", address(nvda));
        stakes.setToken("TSLA", address(fee));
        corp.transfer(player, 100);
        corp.transfer(bot, 40);
        nvda.mint(bot, 1000);
        fee.mint(bot, 1000);
        nvda.mint(player, 500);
        fee.mint(player, 500);
    }

    function assertEq(uint256 a, uint256 b) internal pure {
        require(a == b, "eq");
    }

    function test_total_backing_le_vault_balance() public {
        vm.startPrank(player);
        corp.approve(address(vault), 100);
        vault.deposit(player, 100);
        vm.stopPrank();
        vault.mintCapital(player, 100);
        require(vault.totalBacking() <= corp.balanceOf(address(vault)), "backing");
        vm.prank(safetySigner);
        vault.refundPlayer(player, 40);
        require(vault.totalBacking() <= corp.balanceOf(address(vault)), "after");
        assertEq(vault.backingOf(player), 60);
    }

    function test_guardian_cannot_slice_or_refund() public {
        vm.startPrank(bot);
        nvda.approve(address(prizes), 100);
        prizes.deposit(address(nvda), 0, 100);
        vm.stopPrank();
        address[] memory players = new address[](1);
        players[0] = player;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 10;
        vm.prank(guardian);
        vm.expectRevert();
        prizes.slice(address(nvda), 0, players, amounts);
        vm.startPrank(player);
        corp.approve(address(vault), 50);
        vault.deposit(player, 50);
        vm.stopPrank();
        vault.mintCapital(player, 50);
        vm.prank(guardian);
        vm.expectRevert();
        vault.refundPlayer(player, 1);
    }

    function test_fee_on_transfer_credits_delta() public {
        vm.startPrank(bot);
        fee.approve(address(prizes), 1000);
        prizes.deposit(address(fee), 0, 1000);
        vm.stopPrank();
        assertEq(prizes.unsliced(0, address(fee)), 900);
        address[] memory players = new address[](1);
        players[0] = player;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 901;
        vm.prank(safetySigner);
        vm.expectRevert();
        prizes.slice(address(fee), 0, players, amounts);
        amounts[0] = 900;
        vm.prank(safetySigner);
        prizes.slice(address(fee), 0, players, amounts);
        assertEq(prizes.unsliced(0, address(fee)), 0);
        assertEq(prizes.owed(0, address(fee), player), 900);
    }

    function test_stake_fee_credits_delta() public {
        vm.startPrank(player);
        fee.approve(address(stakes), 100);
        stakes.stake(player, "TSLA", 100);
        vm.stopPrank();
        (string[] memory tickers, uint256[] memory amounts) = stakes.snapshot(player);
        require(tickers.length >= 1, "rows");
        uint256 i;
        uint256 tsla;
        while (i < tickers.length) {
            if (keccak256(bytes(tickers[i])) == keccak256(bytes("TSLA"))) {
                tsla = amounts[i];
            }
            i += 1;
        }
        assertEq(tsla, 90);
    }

    function test_deposit_zero_and_empty_slice() public {
        vm.startPrank(bot);
        nvda.approve(address(prizes), 10);
        vm.expectRevert();
        prizes.deposit(address(nvda), 0, 0);
        prizes.deposit(address(nvda), 0, 10);
        vm.stopPrank();
        address[] memory players;
        uint256[] memory amounts;
        vm.prank(safetySigner);
        prizes.slice(address(nvda), 0, players, amounts);
        assertEq(prizes.unsliced(0, address(nvda)), 10);
    }

    function test_claim_after_return_unsettled() public {
        vm.startPrank(bot);
        nvda.approve(address(prizes), 100);
        prizes.deposit(address(nvda), 0, 100);
        vm.stopPrank();
        address[] memory players = new address[](1);
        players[0] = player;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 40;
        vm.prank(safetySigner);
        prizes.slice(address(nvda), 0, players, amounts);
        vm.prank(bot);
        prizes.returnUnsettled(address(nvda), 0);
        assertEq(prizes.owed(0, address(nvda), player), 40);
        vm.prank(player);
        prizes.claimPrize(address(nvda), 0);
        assertEq(nvda.balanceOf(player), 540);
    }

    function test_voucher_reserves_and_blocks_refund() public {
        vm.startPrank(player);
        corp.approve(address(vault), 100);
        vault.deposit(player, 100);
        vm.stopPrank();
        vault.mintCapital(player, 100);
        uint256 issuedAt = block.timestamp;
        vault.issueVoucher("r1", player, 60, issuedAt);
        assertEq(vault.reservedOf(player), 60);
        assertEq(vault.availableOf(player), 40);
        vm.prank(safetySigner);
        vm.expectRevert();
        vault.refundPlayer(player, 41);
        vm.prank(safetySigner);
        vault.refundPlayer(player, 40);
        assertEq(vault.availableOf(player), 0);
        vault.presentVoucher("r1", player, 60, issuedAt);
        assertEq(vault.reservedOf(player), 0);
        assertEq(vault.backingOf(player), 0);
        assertEq(corp.balanceOf(player), 100);
    }

    function test_expired_voucher_releases_reservation() public {
        vm.startPrank(player);
        corp.approve(address(vault), 50);
        vault.deposit(player, 50);
        vm.stopPrank();
        vault.mintCapital(player, 50);
        uint256 issuedAt = block.timestamp;
        vault.issueVoucher("exp", player, 50, issuedAt);
        vm.warp(issuedAt + PackConstants.VOUCHER_TTL_S + 1);
        vm.expectRevert();
        vault.presentVoucher("exp", player, 50, issuedAt);
        vault.releaseExpiredVoucher("exp");
        assertEq(vault.reservedOf(player), 0);
        assertEq(vault.availableOf(player), 50);
        vm.expectRevert();
        vault.releaseExpiredVoucher("exp");
        vm.prank(safetySigner);
        vault.refundPlayer(player, 50);
        assertEq(vault.backingOf(player), 0);
        assertEq(corp.balanceOf(player), 100);
    }

    function test_claim_refund_merkle_without_pause() public {
        vm.startPrank(player);
        corp.approve(address(vault), 80);
        vault.deposit(player, 80);
        vm.stopPrank();
        vault.mintCapital(player, 80);
        bytes32 leaf = keccak256(abi.encodePacked(player, uint256(30)));
        vm.prank(guardian);
        vault.setRefundRoot(leaf);
        bytes32[] memory proof;
        vm.prank(player);
        vault.claimRefund(30, proof);
        assertEq(vault.backingOf(player), 50);
        assertEq(corp.balanceOf(player), 50);
        vm.prank(player);
        vm.expectRevert();
        vault.claimRefund(30, proof);
    }

    function test_holder_unstake() public {
        vm.startPrank(player);
        nvda.approve(address(stakes), 200);
        stakes.stake(player, "NVDA", 200);
        vm.stopPrank();
        assertEq(nvda.balanceOf(player), 300);
        vm.prank(player);
        stakes.unstake("NVDA", 80);
        assertEq(stakes.amountOf(player, keccak256(bytes("NVDA"))), 120);
        assertEq(nvda.balanceOf(player), 380);
        vm.prank(guardian);
        vm.expectRevert();
        stakes.unstake("NVDA", 1);
        vm.prank(player);
        vm.expectRevert();
        stakes.unstake("NVDA", 121);
    }

    function testFuzz_depositGot(uint96 amount) public {
        if (amount == 0) {
            amount = 1;
        }
        if (amount > 400) {
            amount = uint96((uint256(amount) % 400) + 1);
        }
        nvda.mint(bot, amount);
        vm.startPrank(bot);
        nvda.approve(address(prizes), amount);
        uint256 before = prizes.unsliced(1, address(nvda));
        prizes.deposit(address(nvda), 1, amount);
        vm.stopPrank();
        assertEq(prizes.unsliced(1, address(nvda)), before + amount);
    }
}
