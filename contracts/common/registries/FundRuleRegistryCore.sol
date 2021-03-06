/*
 * Copyright ©️ 2020 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2020 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

pragma solidity ^0.5.13;

import "@galtproject/libs/contracts/traits/Initializable.sol";
import "../interfaces/IFundRegistry.sol";
import "@galtproject/libs/contracts/collections/ArraySet.sol";
import "@openzeppelin/contracts/drafts/Counters.sol";
import "./interfaces/IFundRuleRegistry.sol";
import "../interfaces/IFundStorage.sol";
import "@galtproject/core/contracts/traits/ChargesEthFee.sol";
import "@galtproject/private-property-registry/contracts/interfaces/IPPGlobalRegistry.sol";


contract FundRuleRegistryCore is IFundRuleRegistry, ChargesEthFee, Initializable {
  using Counters for Counters.Counter;
  using ArraySet for ArraySet.Uint256Set;

  uint256 public constant VERSION = 1;

  bytes32 public constant ROLE_ADD_FUND_RULE_MANAGER = bytes32("ADD_FUND_RULE_MANAGER");
  bytes32 public constant ROLE_DEACTIVATE_FUND_RULE_MANAGER = bytes32("DEACTIVATE_FUND_RULE_MANAGER");

  IFundRegistry public fundRegistry;
  ArraySet.Uint256Set internal _activeFundRules;
  uint256[] internal _meetings;

  Counters.Counter internal fundRuleCounter;

  // FRP => fundRuleDetails
  mapping(uint256 => FundRule) public fundRules;

  // ID => meetingDetails
  mapping(uint256 => Meeting) public meetings;
  mapping(uint256 => bytes[]) public meetingsProposalsData;
  mapping(uint256 => string[]) public meetingsProposalsDataLink;

  uint256 public meetingNoticePeriod;

  modifier onlyRole(bytes32 _role) {
    require(fundRegistry.getACL().hasRole(msg.sender, _role), "Invalid role");

    _;
  }

  modifier canManageMeeting() {
    IFundStorage fundStorage = IFundStorage(fundRegistry.getStorageAddress());
    require(
      fundStorage.isFundMemberOrMultiSigOwner(msg.sender) || fundStorage.serviceCompany() == msg.sender,
      "msg.sender can't manage meeting"
    );

    _;
  }

  constructor() public {
  }

  function initialize(address _fundRegistry) external isInitializer {
    fundRegistry = IFundRegistry(_fundRegistry);
    meetingNoticePeriod = 864000;
  }

  function feeRegistry() public view returns(address) {
    return IPPGlobalRegistry(fundRegistry.getPPGRAddress()).getPPFeeRegistryAddress();
  }

  // GETTERS

  function getActiveFundRules() external view returns (uint256[] memory) {
    return _activeFundRules.elements();
  }

  function getActiveFundRulesCount() external view returns (uint256) {
    return _activeFundRules.size();
  }

  function getMeetings() external view returns (uint256[] memory) {
    return _meetings;
  }

  function getMeetingsCount() external view returns (uint256) {
    return _meetings.length;
  }

  function getMeetingProposalsDataCount(uint256 _meetingId) external view returns (uint256) {
    return meetingsProposalsData[_meetingId].length;
  }

  function isMeetingActive(uint256 _meetingId) external view returns (bool) {
    return meetings[_meetingId].active;
  }

  function isMeetingStarted(uint256 _meetingId) external view returns (bool) {
    return block.timestamp > meetings[_meetingId].startOn;
  }

  function isMeetingEnded(uint256 _meetingId) external view returns (bool) {
    return block.timestamp > meetings[_meetingId].endOn;
  }
}
