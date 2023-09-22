// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import "openzeppelin-contracts/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "openzeppelin-contracts/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import "openzeppelin-contracts/contracts/access/Ownable.sol";

contract WIRON is ERC20, ERC20Burnable, ERC20Pausable, Ownable {
    constructor() ERC20("WIRON", "Wrapped IRON") {}

    // Function to mint new tokens (only callable by the owner)
    function mint(address account, uint256 amount) public onlyOwner {
        _mint(account, amount);
    }

    // Function to pause the contract (only callable by the owner)
    function pause() public onlyOwner {
        _pause();
    }

    // Function to unpause the contract (only callable by the owner)
    function unpause() public onlyOwner {
        _unpause();
    }

    function _beforeTokenTransfer(address from, address to, uint256 amount)
        internal
        virtual
        override(ERC20, ERC20Pausable)
    {
        super._beforeTokenTransfer(from, to, amount);
    }
}
