// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// Local $CORP double. Production token is pons factory; tax lives in the pool, not transfer.
/// DESIGN.md §2.1, §10.
contract CorpToken {
    string public constant name = "CORP";
    string public constant symbol = "CORP";
    uint8 public constant decimals = 18;

    uint16 public immutable creatorTaxBps;
    address public immutable minter;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    constructor(uint16 taxBps, address minter_, uint256 supply) {
        creatorTaxBps = taxBps;
        minter = minter_;
        if (supply > 0) {
            _mint(minter_, supply);
        }
    }

    function mint(address to, uint256 amount) external {
        require(msg.sender == minter, "minter");
        _mint(to, amount);
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _move(msg.sender, to, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        require(allowed >= amount, "allowance");
        if (allowed != type(uint256).max) {
            allowance[from][msg.sender] = allowed - amount;
        }
        _move(from, to, amount);
        return true;
    }

    function _mint(address to, uint256 amount) internal {
        require(to != address(0) && amount > 0, "mint");
        totalSupply += amount;
        balanceOf[to] += amount;
    }

    function _move(address from, address to, uint256 amount) internal {
        require(from != address(0) && to != address(0) && amount > 0, "transfer");
        uint256 have = balanceOf[from];
        require(have >= amount, "balance");
        balanceOf[from] = have - amount;
        balanceOf[to] += amount;
    }
}
