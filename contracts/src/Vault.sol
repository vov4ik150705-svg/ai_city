// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

interface IERC20Vault {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/// Deposit $CORP, then mint Capital. Withdraw via signed voucher. Safety: pause,
/// refundPlayer ≤ backingOf, Merkle refundRoot. Bank hours stay on the server.
/// DESIGN.md §2.3, §10, §10.1. PLAN_MONEY §15 D-M-14.
contract Vault {
    IERC20Vault public immutable corp;
    address public immutable minter;
    address public immutable voucherSigner;
    address public immutable guardian;
    address public signer;
    address public pendingSigner;
    uint256 public immutable capitalAnchor;
    uint256 public immutable voucherTtlS;
    uint256 public immutable unpauseDelay;
    bool public paused;
    uint256 public pauseReadyAt;
    bytes32 public refundRoot;
    uint256 public totalBacking;

    mapping(address => uint256) public capitalOf;
    mapping(address => uint256) public pending;
    mapping(address => uint256) public backingOf;
    mapping(string => Issued) public issued;
    mapping(string => bool) public used;
    mapping(address => bool) public refundClaimed;

    bytes32 public immutable DOMAIN_SEPARATOR;

    struct Issued {
        address account;
        uint256 corpAmount;
        uint256 issuedAtS;
    }

    constructor(
        address corp_,
        address minter_,
        address voucherSigner_,
        address guardian_,
        address signer_,
        uint256 capitalAnchor_,
        uint256 voucherTtlS_,
        uint256 unpauseDelay_
    ) {
        require(corp_ != address(0) && minter_ != address(0) && voucherSigner_ != address(0), "roles");
        require(guardian_ != address(0) && signer_ != address(0), "safety");
        require(guardian_ != signer_, "roles");
        require(capitalAnchor_ > 0 && voucherTtlS_ > 0 && unpauseDelay_ > 0, "params");
        corp = IERC20Vault(corp_);
        minter = minter_;
        voucherSigner = voucherSigner_;
        guardian = guardian_;
        signer = signer_;
        capitalAnchor = capitalAnchor_;
        voucherTtlS = voucherTtlS_;
        unpauseDelay = unpauseDelay_;
        DOMAIN_SEPARATOR = keccak256(
            abi.encode(keccak256("Vault"), address(this), capitalAnchor_, unpauseDelay_)
        );
    }

    function vaultCorp() external view returns (uint256) {
        return corp.balanceOf(address(this));
    }

    function corpInVault() external view returns (uint256) {
        return corp.balanceOf(address(this));
    }

    function deposit(address account, uint256 corpAmount) external {
        require(!paused, "paused");
        require(account != address(0) && corpAmount > 0, "deposit");
        uint256 before = corp.balanceOf(address(this));
        require(corp.transferFrom(account, address(this), corpAmount), "pull");
        uint256 afterBal = corp.balanceOf(address(this));
        require(afterBal >= before, "pull");
        uint256 got = afterBal - before;
        require(got > 0, "got");
        pending[account] += got;
    }

    function mintCapital(address account, uint256 capitalAmount) external {
        require(msg.sender == minter, "minter");
        require(account != address(0) && capitalAmount > 0, "mint");
        uint256 queued = pending[account];
        require(queued > 0, "pending");
        require(capitalAmount <= queued * capitalAnchor, "anchor");
        pending[account] = 0;
        backingOf[account] += queued;
        totalBacking += queued;
        capitalOf[account] += capitalAmount;
    }

    function issueVoucher(string calldata nonce, address account, uint256 corpAmount, uint256 issuedAtS)
        external
    {
        require(msg.sender == voucherSigner, "signer");
        require(bytes(nonce).length > 0 && account != address(0) && corpAmount > 0, "voucher");
        require(!used[nonce] && issued[nonce].account == address(0), "replay");
        issued[nonce] = Issued({account: account, corpAmount: corpAmount, issuedAtS: issuedAtS});
    }

    function presentVoucher(string calldata nonce, address account, uint256 corpAmount, uint256 issuedAtS)
        external
    {
        require(!paused, "paused");
        require(bytes(nonce).length > 0 && account != address(0) && corpAmount > 0, "voucher");
        require(block.timestamp <= issuedAtS + voucherTtlS, "expired");
        Issued memory known = issued[nonce];
        require(known.account == account && known.corpAmount == corpAmount && known.issuedAtS == issuedAtS, "unknown");
        require(!used[nonce], "replay");
        require(corp.balanceOf(address(this)) >= corpAmount, "cover");
        used[nonce] = true;
        delete issued[nonce];
        _releaseBacking(account, corpAmount);
        require(corp.transfer(account, corpAmount), "push");
    }

    function pause() external {
        require(msg.sender == guardian, "guardian");
        require(!paused, "paused");
        paused = true;
        pauseReadyAt = block.timestamp + unpauseDelay;
    }

    function unpause() external {
        require(msg.sender == guardian, "guardian");
        require(paused, "not paused");
        require(block.timestamp >= pauseReadyAt, "delay");
        paused = false;
        refundRoot = bytes32(0);
    }

    function proposeSigner(address next) external {
        require(msg.sender == guardian, "guardian");
        require(next != address(0) && next != guardian, "next");
        pendingSigner = next;
    }

    function acceptSigner() external {
        require(msg.sender == pendingSigner, "pending");
        signer = pendingSigner;
        pendingSigner = address(0);
    }

    function refundPlayer(address player, uint256 amount) external {
        require(paused, "paused");
        require(msg.sender == signer, "signer");
        _refund(player, amount);
    }

    function batchRefundPlayers(address[] calldata players, uint256[] calldata amounts) external {
        require(paused, "paused");
        require(msg.sender == signer, "signer");
        require(players.length == amounts.length, "len");
        uint256 i;
        while (i < players.length) {
            _refund(players[i], amounts[i]);
            i += 1;
        }
    }

    function setRefundRoot(bytes32 root) external {
        require(paused, "paused");
        require(msg.sender == guardian, "guardian");
        refundRoot = root;
    }

    function claimRefund(uint256 amount, bytes32[] calldata proof) external {
        require(paused, "paused");
        require(!refundClaimed[msg.sender], "claimed");
        bytes32 leaf = keccak256(abi.encodePacked(msg.sender, amount));
        require(_verify(refundRoot, leaf, proof), "proof");
        refundClaimed[msg.sender] = true;
        _refund(msg.sender, amount);
    }

    function recoverWrongToken(address token) external {
        require(msg.sender == guardian, "guardian");
        require(token != address(corp), "corp");
        IERC20Vault other = IERC20Vault(token);
        uint256 bal = other.balanceOf(address(this));
        require(bal > 0, "empty");
        require(other.transfer(guardian, bal), "push");
    }

    function _refund(address player, uint256 amount) internal {
        require(player != address(0) && amount > 0, "refund");
        uint256 backing = backingOf[player];
        require(amount <= backing, "backing");
        backingOf[player] = backing - amount;
        totalBacking -= amount;
        uint256 cap = backingOf[player] * capitalAnchor;
        if (capitalOf[player] > cap) {
            capitalOf[player] = cap;
        }
        require(corp.transfer(player, amount), "push");
    }

    function _releaseBacking(address account, uint256 corpAmount) internal {
        uint256 backing = backingOf[account];
        require(backing >= corpAmount, "backing");
        backingOf[account] = backing - corpAmount;
        totalBacking -= corpAmount;
        uint256 cap = backingOf[account] * capitalAnchor;
        if (capitalOf[account] > cap) {
            capitalOf[account] = cap;
        }
    }

    function _verify(bytes32 root, bytes32 leaf, bytes32[] calldata proof) internal pure returns (bool) {
        bytes32 h = leaf;
        uint256 i;
        while (i < proof.length) {
            h = keccak256(abi.encodePacked(h, proof[i]));
            i += 1;
        }
        return h == root;
    }
}
