/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

pragma solidity ^0.5.13;

import "@galtproject/libs/contracts/traits/Initializable.sol";
import "./interfaces/IFundRegistry.sol";


interface UpgradeScript {
  function argsWithSignature() external view returns (bytes memory);
}


contract FundUpgrader is Initializable {
  event UpgradeSucceeded();
  event UpgradeFailed(bytes result);

  bytes32 public constant ROLE_UPGRADE_SCRIPT_MANAGER = bytes32("upgrade_script_manager");

  IFundRegistry public fundRegistry;

  address public nextUpgradeScript;

  modifier onlyUpgradeScriptManager() {
    require(fundRegistry.getACL().hasRole(msg.sender, ROLE_UPGRADE_SCRIPT_MANAGER), "Invalid role");

    _;
  }

  constructor() public {
  }

  function initialize(IFundRegistry _fundRegistry) external isInitializer {
    fundRegistry = _fundRegistry;
  }

  function setNextUpgradeScript(address _nextUpgadeScript) external onlyUpgradeScriptManager {
    nextUpgradeScript = _nextUpgadeScript;
  }

  function upgrade() external {
    require(nextUpgradeScript != address(0), "Upgrade script not set");

    // solium-disable-next-line security/no-low-level-calls
    (bool ok, bytes memory res) = nextUpgradeScript.delegatecall(
      UpgradeScript(nextUpgradeScript).argsWithSignature()
    );

    if (ok == true) {
      nextUpgradeScript = address(0);
      emit UpgradeSucceeded();
    } else {
      emit UpgradeFailed(res);
    }
  }
}