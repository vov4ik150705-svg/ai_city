// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

interface IERC20Vault {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/// Deposit $CORP, then mint Capital. Withdraw via signed voucher. Safety: coverage
/// reservation on issue, refundPlayer ≤ available backing, Merkle refundRoot.
/// Bank hours stay on the server. DESIGN.md §2.3, §10, §10.1. PLAN_MONEY §15 D-M-14.
contract Vault {
    IERC20Vault public immutable corp;
    address public immutable minter;
    address public immutable voucherSigner;
    address public immutable guardian;
    address public signer;
    address public pendingSigner;
    address public immutable house;
    uint256 public immutable capitalAnchor;
    uint256 public immutable voucherTtlS;
    bytes32 public refundRoot;
    uint256 public totalBacking;
    uint256 public totalPending;
    uint256 public totalReserved;
    uint256 public totalUncovered;

    mapping(address => uint256) public capitalOf;
    mapping(address => uint256) public pending;
    mapping(address => uint256) public backingOf;
    mapping(address => uint256) public reservedOf;
    mapping(address => uint256) public uncoveredOf;
    uint8 public constant OUTCOME_PRESENTED = 1;
    uint8 public constant OUTCOME_RELEASED = 2;

    mapping(string => Issued) public issued;
    mapping(string => bool) public used;
    mapping(string => uint8) public outcomeOf;
    mapping(address => bool) public refundClaimed;

    bytes32 public immutable DOMAIN_SEPARATOR;

    struct Issued {
        address account;
        uint256 corpAmount;
        uint256 issuedAtS;
    }

    event VoucherIssued(string nonce, address account, uint256 corpAmount, uint256 issuedAtS);
    event VoucherPresented(string nonce, address account, uint256 corpAmount);
    event VoucherReleased(string nonce);

    constructor(
        address corp_,
        address minter_,
        address voucherSigner_,
        address guardian_,
        address signer_,
        uint256 capitalAnchor_,
        uint256 voucherTtlS_,
        address house_
    ) {
        require(corp_ != address(0) && minter_ != address(0) && voucherSigner_ != address(0), "roles");
        require(guardian_ != address(0) && signer_ != address(0), "safety");
        require(guardian_ != signer_, "roles");
        require(capitalAnchor_ > 0 && voucherTtlS_ > 0, "params");
        corp = IERC20Vault(corp_);
        minter = minter_;
        voucherSigner = voucherSigner_;
        guardian = guardian_;
        signer = signer_;
        house = house_;
        capitalAnchor = capitalAnchor_;
        voucherTtlS = voucherTtlS_;
        DOMAIN_SEPARATOR = keccak256(
            abi.encode(keccak256("Vault"), address(this), capitalAnchor_)
        );
    }

    function vaultCorp() external view returns (uint256) {
        return corp.balanceOf(address(this));
    }

    function corpInVault() external view returns (uint256) {
        return corp.balanceOf(address(this));
    }

    function availableOf(address account) public view returns (uint256) {
        uint256 backing = backingOf[account];
        uint256 reserved = reservedOf[account];
        if (reserved >= backing) return 0;
        return backing - reserved;
    }

    function deposit(address account, uint256 corpAmount) external {
        require(msg.sender == account, "sender");
        require(account != address(0) && corpAmount > 0, "deposit");
        uint256 before = corp.balanceOf(address(this));
        require(corp.transferFrom(account, address(this), corpAmount), "pull");
        uint256 afterBal = corp.balanceOf(address(this));
        require(afterBal >= before, "pull");
        uint256 got = afterBal - before;
        require(got > 0, "got");
        pending[account] += got;
        totalPending += got;
    }

    function mintCapital(address account, uint256 corpAmount, uint256 capitalAmount) external {
        require(msg.sender == minter, "minter");
        require(account != address(0) && corpAmount > 0 && capitalAmount > 0, "mint");
        uint256 queued = pending[account];
        require(queued >= corpAmount, "pending");
        if (corpAmount <= type(uint256).max / capitalAnchor) {
            require(capitalAmount <= corpAmount * capitalAnchor, "anchor");
        }
        pending[account] = queued - corpAmount;
        totalPending -= corpAmount;
        backingOf[account] += corpAmount;
        totalBacking += corpAmount;
        capitalOf[account] += capitalAmount;
        _syncUncovered(account);
    }

    function issueVoucher(string calldata nonce, address account, uint256 corpAmount, uint256 issuedAtS)
        external
    {
        require(msg.sender == voucherSigner, "signer");
        require(bytes(nonce).length > 0 && account != address(0) && corpAmount > 0, "voucher");
        require(!used[nonce] && issued[nonce].account == address(0), "replay");
        require(issuedAtS <= block.timestamp, "time");
        require(issuedAtS <= type(uint256).max - voucherTtlS, "time");
        require(corpAmount <= voucherRoom(account), "cover");
        reservedOf[account] += corpAmount;
        totalReserved += corpAmount;
        _syncUncovered(account);
        issued[nonce] = Issued({account: account, corpAmount: corpAmount, issuedAtS: issuedAtS});
        emit VoucherIssued(nonce, account, corpAmount, issuedAtS);
    }

    function voucherRoom(address account) public view returns (uint256) {
        uint256 bal = corp.balanceOf(address(this));
        uint256 own = backingOf[account];
        uint256 houseBal = backingOf[house];
        uint256 others = totalBacking - own;
        if (account != house && pending[account] == 0) others -= houseBal;
        uint256 ownUncovered = uncoveredOf[account];
        uint256 othersUncovered = totalUncovered - ownUncovered;
        uint256 locked = others + totalPending + reservedOf[account] + othersUncovered;
        if (bal > locked) return bal - locked;
        return 0;
    }

    function presentVoucher(string calldata nonce, address account, uint256 corpAmount, uint256 issuedAtS)
        external
    {
        require(bytes(nonce).length > 0 && account != address(0) && corpAmount > 0, "voucher");
        require(block.timestamp <= issuedAtS + voucherTtlS, "expired");
        Issued memory known = issued[nonce];
        require(known.account == account && known.corpAmount == corpAmount && known.issuedAtS == issuedAtS, "unknown");
        require(!used[nonce], "replay");
        uint256 fromOwn = backingOf[account];
        if (fromOwn > corpAmount) fromOwn = corpAmount;
        uint256 left = corpAmount - fromOwn;
        uint256 fromHouse = 0;
        if (account != house && left > 0) {
            fromHouse = backingOf[house];
            if (fromHouse > left) fromHouse = left;
            left = left - fromHouse;
        }
        uint256 bal = corp.balanceOf(address(this));
        uint256 assigned = totalBacking + totalPending;
        require(bal >= corpAmount && bal >= assigned && bal - assigned >= left, "cover");
        used[nonce] = true;
        outcomeOf[nonce] = OUTCOME_PRESENTED;
        delete issued[nonce];
        _consumeReserved(account, corpAmount);
        _debitBacking(account, fromOwn);
        _debitBacking(house, fromHouse);
        require(corp.transfer(account, corpAmount), "push");
        emit VoucherPresented(nonce, account, corpAmount);
    }

    function releaseExpiredVoucher(string calldata nonce) external {
        Issued memory known = issued[nonce];
        require(known.account != address(0) && known.corpAmount > 0, "unknown");
        require(!used[nonce], "replay");
        require(block.timestamp > known.issuedAtS + voucherTtlS, "ttl");
        used[nonce] = true;
        outcomeOf[nonce] = OUTCOME_RELEASED;
        delete issued[nonce];
        _consumeReserved(known.account, known.corpAmount);
        emit VoucherReleased(nonce);
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
        require(msg.sender == signer, "signer");
        _refund(player, amount);
    }

    function batchRefundPlayers(address[] calldata players, uint256[] calldata amounts) external {
        require(msg.sender == signer, "signer");
        require(players.length == amounts.length, "len");
        uint256 i;
        while (i < players.length) {
            _refund(players[i], amounts[i]);
            i += 1;
        }
    }

    function setRefundRoot(bytes32 root) external {
        require(msg.sender == guardian, "guardian");
        refundRoot = root;
    }

    function claimRefund(uint256 amount, bytes32[] calldata proof) external {
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
        uint256 avail = availableOf(player);
        require(amount <= avail, "backing");
        backingOf[player] = backingOf[player] - amount;
        totalBacking -= amount;
        uint256 cap = backingOf[player] * capitalAnchor;
        if (capitalOf[player] > cap) {
            capitalOf[player] = cap;
        }
        require(corp.transfer(player, amount), "push");
        _syncUncovered(player);
    }

    function _consumeReserved(address account, uint256 corpAmount) internal {
        uint256 reserved = reservedOf[account];
        require(reserved >= corpAmount, "reserved");
        reservedOf[account] = reserved - corpAmount;
        totalReserved -= corpAmount;
        _syncUncovered(account);
    }

    function _debitBacking(address account, uint256 amount) internal {
        if (amount == 0) return;
        uint256 backing = backingOf[account];
        require(backing >= amount, "backing");
        backingOf[account] = backing - amount;
        totalBacking -= amount;
        uint256 cap = backingOf[account] * capitalAnchor;
        if (capitalOf[account] > cap) {
            capitalOf[account] = cap;
        }
        _syncUncovered(account);
    }

    function _syncUncovered(address account) internal {
        uint256 reserved = reservedOf[account];
        uint256 backing = backingOf[account];
        uint256 next = reserved > backing ? reserved - backing : 0;
        uint256 prev = uncoveredOf[account];
        if (next == prev) return;
        if (next > prev) totalUncovered += next - prev;
        else totalUncovered -= prev - next;
        uncoveredOf[account] = next;
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
