// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

interface IERC20Stake {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/// Stock staking. Snapshot is a recorded input to the tick, not a live RPC inside it.
/// DESIGN.md §4.5, §10.
contract StakeRegistry {
    address public immutable owner;

    mapping(bytes32 => address) public tokenOf;
    mapping(address => mapping(bytes32 => uint256)) public amountOf;
    mapping(address => mapping(bytes32 => bool)) public hasTicker;
    mapping(address => string[]) private _tickers;

    constructor(address owner_) {
        require(owner_ != address(0), "owner");
        owner = owner_;
    }

    function setToken(string calldata ticker, address token) external {
        require(msg.sender == owner, "owner");
        require(bytes(ticker).length > 0 && token != address(0), "token");
        tokenOf[keccak256(bytes(ticker))] = token;
    }

    function stake(address account, string calldata ticker, uint256 amount) external {
        require(account != address(0) && bytes(ticker).length > 0 && amount > 0, "stake");
        bytes32 key = keccak256(bytes(ticker));
        address token = tokenOf[key];
        require(token != address(0), "listed");
        IERC20Stake t = IERC20Stake(token);
        uint256 before = t.balanceOf(address(this));
        require(t.transferFrom(account, address(this), amount), "pull");
        uint256 afterBal = t.balanceOf(address(this));
        require(afterBal >= before, "pull");
        uint256 got = afterBal - before;
        require(got > 0, "got");
        if (!hasTicker[account][key]) {
            hasTicker[account][key] = true;
            _tickers[account].push(ticker);
        }
        amountOf[account][key] += got;
    }

    function unstake(string calldata ticker, uint256 amount) external {
        require(bytes(ticker).length > 0 && amount > 0, "unstake");
        bytes32 key = keccak256(bytes(ticker));
        address token = tokenOf[key];
        require(token != address(0), "listed");
        uint256 have = amountOf[msg.sender][key];
        require(have >= amount, "amount");
        amountOf[msg.sender][key] = have - amount;
        require(IERC20Stake(token).transfer(msg.sender, amount), "push");
    }

    function snapshot(address account) external view returns (string[] memory tickers, uint256[] memory amounts) {
        string[] storage listed = _tickers[account];
        uint256 n = listed.length;
        tickers = new string[](n);
        amounts = new uint256[](n);
        for (uint256 i = 0; i < n; i++) {
            tickers[i] = listed[i];
            amounts[i] = amountOf[account][keccak256(bytes(listed[i]))];
        }
        _sort(tickers, amounts);
    }

    function _less(string memory a, string memory b) internal pure returns (bool) {
        bytes memory ba = bytes(a);
        bytes memory bb = bytes(b);
        uint256 n = ba.length < bb.length ? ba.length : bb.length;
        for (uint256 i = 0; i < n; i++) {
            if (uint8(ba[i]) < uint8(bb[i])) return true;
            if (uint8(ba[i]) > uint8(bb[i])) return false;
        }
        return ba.length < bb.length;
    }

    function _sort(string[] memory tickers, uint256[] memory amounts) internal pure {
        uint256 n = tickers.length;
        for (uint256 i = 1; i < n; i++) {
            for (uint256 j = i; j > 0; j--) {
                if (!_less(tickers[j], tickers[j - 1])) break;
                (tickers[j - 1], tickers[j]) = (tickers[j], tickers[j - 1]);
                (amounts[j - 1], amounts[j]) = (amounts[j], amounts[j - 1]);
            }
        }
    }
}
