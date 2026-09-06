// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

interface IERC20Prize {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/// Two unmixed kettles (farm, month). Bot deposits; players claim settled rows.
/// returnUnsettled sends unsliced dust to the depositor bot, never settled rows.
/// DESIGN.md §10, PLAN_MONEY §15 D-M-13.
contract PrizeTreasury {
    uint8 public constant KETTLE_FARM = 0;
    uint8 public constant KETTLE_MONTH = 1;

    address public immutable depositor;
    address public immutable guardian;
    address public signer;
    address public pendingSigner;
    uint256 public immutable unpauseDelay;
    bool public paused;
    uint256 public pauseReadyAt;
    uint256 public immutable stockCount;

    mapping(address => bool) public isPrizeStock;
    mapping(uint8 => mapping(address => uint256)) public unsliced;
    mapping(uint8 => mapping(address => mapping(address => uint256))) public owed;

    constructor(
        address depositor_,
        address guardian_,
        address signer_,
        uint256 unpauseDelay_,
        address[] memory stocks_
    ) {
        require(depositor_ != address(0) && guardian_ != address(0) && signer_ != address(0), "roles");
        require(guardian_ != signer_, "roles");
        require(unpauseDelay_ > 0, "delay");
        require(stocks_.length == 6, "stocks");
        depositor = depositor_;
        guardian = guardian_;
        signer = signer_;
        unpauseDelay = unpauseDelay_;
        uint256 i;
        while (i < stocks_.length) {
            address t = stocks_[i];
            require(t != address(0) && !isPrizeStock[t], "stock");
            isPrizeStock[t] = true;
            i += 1;
        }
        stockCount = stocks_.length;
    }

    function deposit(address token, uint8 kettle, uint256 amount) external {
        require(!paused, "paused");
        require(msg.sender == depositor, "bot");
        require(_kettleOk(kettle) && isPrizeStock[token] && amount > 0, "dep");
        IERC20Prize t = IERC20Prize(token);
        uint256 before = t.balanceOf(address(this));
        require(t.transferFrom(msg.sender, address(this), amount), "pull");
        uint256 afterBal = t.balanceOf(address(this));
        require(afterBal >= before, "pull");
        uint256 got = afterBal - before;
        require(got > 0, "got");
        unsliced[kettle][token] += got;
    }

    function slice(address token, uint8 kettle, address[] calldata players, uint256[] calldata amounts)
        external
    {
        require(msg.sender == signer, "signer");
        require(_kettleOk(kettle) && isPrizeStock[token], "slice");
        require(players.length == amounts.length, "len");
        uint256 sum;
        uint256 i;
        while (i < players.length) {
            require(players[i] != address(0), "player");
            sum += amounts[i];
            owed[kettle][token][players[i]] += amounts[i];
            i += 1;
        }
        uint256 bag = unsliced[kettle][token];
        require(sum <= bag, "bag");
        unsliced[kettle][token] = bag - sum;
    }

    function returnUnsettled(address token, uint8 kettle) external {
        require(paused, "paused");
        require(msg.sender == depositor, "bot");
        require(_kettleOk(kettle) && isPrizeStock[token], "ret");
        uint256 bag = unsliced[kettle][token];
        require(bag > 0, "empty");
        unsliced[kettle][token] = 0;
        require(IERC20Prize(token).transfer(depositor, bag), "push");
    }

    function claimPrize(address token, uint8 kettle) external {
        require(!paused, "paused");
        require(_kettleOk(kettle) && isPrizeStock[token], "claim");
        uint256 amt = owed[kettle][token][msg.sender];
        require(amt > 0, "owed");
        owed[kettle][token][msg.sender] = 0;
        require(IERC20Prize(token).transfer(msg.sender, amt), "push");
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

    function recoverWrongToken(address token) external {
        require(msg.sender == guardian, "guardian");
        require(!isPrizeStock[token], "stock");
        IERC20Prize other = IERC20Prize(token);
        uint256 bal = other.balanceOf(address(this));
        require(bal > 0, "empty");
        require(other.transfer(guardian, bal), "push");
    }

    function _kettleOk(uint8 kettle) internal pure returns (bool) {
        return kettle == KETTLE_FARM || kettle == KETTLE_MONTH;
    }
}
