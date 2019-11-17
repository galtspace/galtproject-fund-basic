/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

pragma solidity 0.5.10;

import "../../common/interfaces/IFundRA.sol";
import "../../common/FundMultiSig.sol";


contract IAbstractFundStorage {
  function setDefaultProposalThreshold(uint256 _value) external;

  function setProposalThreshold(bytes32 _key, uint256 _value) external;

  function setConfigValue(bytes32 _key, bytes32 _value) external;
  function addWhiteListedContract(
    address _contract,
    bytes32 _type,
    bytes32 _abiIpfsHash,
    string calldata _description
  )
    external;

  function removeWhiteListedContract(address _contract) external;

  function addProposalMarker(
    bytes4 _methodSignature,
    address _destination,
    address _proposalManager,
    bytes32 _name,
    string calldata _description
  )
    external;

  function removeProposalMarker(bytes32 _marker) external;

  function replaceProposalMarker(bytes32 _oldMarker, bytes32 _newMethodSignature, address _newDestination) external;

  function addFundRule(
    bytes32 _ipfsHash,
    string calldata _description
  )
    external
    returns (uint256);

  function addFeeContract(address _feeContract) external;

  function removeFeeContract(address _feeContract) external;

  function setMemberIdentification(address _member, bytes32 _identificationHash) external;

  function getMemberIdentification(address _member) external view returns(bytes32);

  function disableFundRule(uint256 _id) external;

  function setNameAndDescription(
    string calldata _name,
    string calldata _description
  )
    external;

  function setMultiSigManager(
    bool _active,
    address _manager,
    string calldata _name,
    bytes32[] calldata _documents
  )
    external;

  function setPeriodLimit(bool _active, address _erc20Contract, uint256 _amount) external;

  function handleMultiSigTransaction(
    address _erc20Contract,
    uint256 _amount
  )
    external;

  // GETTERS
  function thresholds(bytes32 _key) external view returns (uint256);

  function defaultProposalThreshold() external view returns (uint256);

  function getThresholdMarker(address _destination, bytes memory _data) public pure returns (bytes32 marker);

  function getConfigValue(bytes32 _key) external view returns (bytes32);

  function getConfigKeys() external view returns (bytes32[] memory);

  function getActiveFundRules() external view returns (uint256[] memory);

  function getActiveFundRulesCount() external view returns (uint256);

  function getMultiSig() public view returns (FundMultiSig);
  function getRA() external view returns (IFundRA);

  function getWhiteListedContract(
    address _contract
  )
    external
    view
    returns (
      bytes32 _contractType,
      bytes32 _abiIpfsHash,
      string memory _description
    );

  function getProposalMarker(
    bytes32 _marker
  )
    external
    view
    returns (
      address _proposalManager,
      address _destination,
      bytes32 _name,
      string memory _description
    );

  function areMembersValid(address[] calldata _members) external view returns (bool);

  function getWhitelistedContracts() external view returns (address[] memory);

  function getProposalMarkers() external view returns (bytes32[] memory);

  function getActiveMultisigManagers() external view returns (address[] memory);

  function getActiveMultisigManagersCount() external view returns (uint256);

  function getActivePeriodLimits() external view returns (address[] memory);

  function getActivePeriodLimitsCount() external view returns (uint256);

  function getFeeContracts() external view returns (address[] memory);

  function getFeeContractCount() external view returns (uint256);

  function getMultisigManager(address _manager)
    external
    view
    returns (
      bool active,
      string memory managerName,
      bytes32[] memory documents
    );

  function getPeriodLimit(address _erc20Contract) external view returns (bool active, uint256 amount);
  function getCurrentPeriod() public view returns (uint256);
}