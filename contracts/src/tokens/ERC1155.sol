// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IERC1155Receiver {
    function onERC1155Received(address operator, address from, uint256 id, uint256 value, bytes calldata data)
        external
        returns (bytes4);

    function onERC1155BatchReceived(
        address operator,
        address from,
        uint256[] calldata ids,
        uint256[] calldata values,
        bytes calldata data
    ) external returns (bytes4);
}

/// @notice Minimal self-contained ERC1155 used as the base for conditional position tokens.
contract ERC1155 {
    event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value);
    event TransferBatch(
        address indexed operator, address indexed from, address indexed to, uint256[] ids, uint256[] values
    );
    event ApprovalForAll(address indexed account, address indexed operator, bool approved);

    mapping(uint256 => mapping(address => uint256)) public balanceOf;
    mapping(address => mapping(address => bool)) public isApprovedForAll;

    function setApprovalForAll(address operator, bool approved) external {
        isApprovedForAll[msg.sender][operator] = approved;
        emit ApprovalForAll(msg.sender, operator, approved);
    }

    function balanceOfBatch(address[] calldata accounts, uint256[] calldata ids)
        external
        view
        returns (uint256[] memory balances)
    {
        require(accounts.length == ids.length, "ERC1155: length mismatch");
        balances = new uint256[](accounts.length);
        for (uint256 i = 0; i < accounts.length; i++) {
            balances[i] = balanceOf[ids[i]][accounts[i]];
        }
    }

    function safeTransferFrom(address from, address to, uint256 id, uint256 value, bytes calldata data) external {
        require(from == msg.sender || isApprovedForAll[from][msg.sender], "ERC1155: not authorized");
        _transfer(from, to, id, value);
        emit TransferSingle(msg.sender, from, to, id, value);
        if (to.code.length > 0) {
            require(
                IERC1155Receiver(to).onERC1155Received(msg.sender, from, id, value, data)
                    == IERC1155Receiver.onERC1155Received.selector,
                "ERC1155: receiver rejected"
            );
        }
    }

    function safeBatchTransferFrom(
        address from,
        address to,
        uint256[] calldata ids,
        uint256[] calldata values,
        bytes calldata data
    ) external {
        require(from == msg.sender || isApprovedForAll[from][msg.sender], "ERC1155: not authorized");
        require(ids.length == values.length, "ERC1155: length mismatch");
        for (uint256 i = 0; i < ids.length; i++) {
            _transfer(from, to, ids[i], values[i]);
        }
        emit TransferBatch(msg.sender, from, to, ids, values);
        if (to.code.length > 0) {
            require(
                IERC1155Receiver(to).onERC1155BatchReceived(msg.sender, from, ids, values, data)
                    == IERC1155Receiver.onERC1155BatchReceived.selector,
                "ERC1155: receiver rejected"
            );
        }
    }

    function _transfer(address from, address to, uint256 id, uint256 value) internal {
        require(to != address(0), "ERC1155: transfer to zero");
        uint256 bal = balanceOf[id][from];
        require(bal >= value, "ERC1155: insufficient balance");
        unchecked {
            balanceOf[id][from] = bal - value;
        }
        balanceOf[id][to] += value;
    }

    function _mint(address to, uint256 id, uint256 value) internal {
        balanceOf[id][to] += value;
        emit TransferSingle(msg.sender, address(0), to, id, value);
    }

    function _burn(address from, uint256 id, uint256 value) internal {
        uint256 bal = balanceOf[id][from];
        require(bal >= value, "ERC1155: burn exceeds balance");
        unchecked {
            balanceOf[id][from] = bal - value;
        }
        emit TransferSingle(msg.sender, from, address(0), id, value);
    }
}
