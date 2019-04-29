/*
 * Copyright ©️ 2018 Galt•Space Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka),
 * [Dima Starodubcev](https://github.com/xhipster),
 * [Valery Litvin](https://github.com/litvintech) by
 * [Basic Agreement](http://cyb.ai/QmSAWEG5u5aSsUyMNYuX2A2Eaz4kEuoYWUkVBRdmu9qmct:ipfs)).
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) and
 * Galt•Space Society Construction and Terraforming Company by
 * [Basic Agreement](http://cyb.ai/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS:ipfs)).
 */

pragma solidity 0.5.3;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "@galtproject/core/contracts/registries/GaltGlobalRegistry.sol";

import "../FundStorage.sol";
import "../FundController.sol";
import "./FundRAFactory.sol";

import "./FundStorageFactory.sol";
import "./FundMultiSigFactory.sol";
import "./FundControllerFactory.sol";

import "./ModifyConfigProposalManagerFactory.sol";
import "./NewMemberProposalManagerFactory.sol";
import "./FineMemberProposalManagerFactory.sol";
import "./ExpelMemberProposalManagerFactory.sol";
import "./WLProposalManagerFactory.sol";
import "./ChangeNameAndDescriptionProposalManagerFactory.sol";
import "./AddFundRuleProposalManagerFactory.sol";
import "./DeactivateFundRuleProposalManagerFactory.sol";
import "./ChangeMultiSigOwnersProposalManagerFactory.sol";
import "./ModifyFeeProposalManagerFactory.sol";
import "./ModifyMultiSigManagerDetailsProposalManagerFactory.sol";
import "./ChangeMultiSigWithdrawalLimitsProposalManagerFactory.sol";


contract FundFactory is Ownable {
  // Pre-defined proposal contracts
  bytes32 public constant MODIFY_CONFIG_TYPE = bytes32("modify_config");
  bytes32 public constant NEW_MEMBER_TYPE = bytes32("new_member");
  bytes32 public constant FINE_MEMBER_TYPE = bytes32("fine_member");
  bytes32 public constant WHITE_LIST_TYPE = bytes32("white_list");
  bytes32 public constant EXPEL_MEMBER_TYPE = bytes32("expel_member");
  bytes32 public constant CHANGE_NAME_AND_DESCRIPTION_TYPE = bytes32("change_info");
  bytes32 public constant ADD_FUND_RULE_TYPE = bytes32("add_rule");
  bytes32 public constant DEACTIVATE_FUND_RULE_TYPE = bytes32("deactivate_rule");
  bytes32 public constant CHANGE_MULTISIG_OWNERS_TYPE = bytes32("change_ms_owners");
  bytes32 public constant MODIFY_FEE_TYPE = bytes32("modify_fee");
  bytes32 public constant MODIFY_MULTISIG_MANAGER_DETAILS_TYPE = bytes32("modify_ms_manager_details");
  bytes32 public constant CHANGE_MULTISIG_WITHDRAWAL_LIMIT_TYPE = bytes32("change_ms_withdrawal_limits");

  event CreateFundFirstStep(
    bytes32 fundId,
    address fundMultiSig,
    address fundStorage
  );

  event CreateFundSecondStep(
    bytes32 fundId,
    address fundController
  );

  event CreateFundThirdStep(
    bytes32 fundId,
    address fundRA,
    address modifyConfigProposalManager,
    address newMemberProposalManager
  );

  event CreateFundFourthStep(
    bytes32 fundId,
    address fineMemberProposalManager,
    address whiteListProposalManager,
    address expelMemberProposalManager
  );

  event CreateFundFifthStep(
    bytes32 fundId,
    address changeNameAndDescriptionProposalManager
  );

  event CreateFundSixthStep(
    bytes32 fundId,
    address addFundRuleProposalManager,
    address deactivateFundRuleProposalManager
  );

  event CreateFundSeventhStep(
    bytes32 fundId,
    address changeMultiSigOwnersProposalManager,
    address modifyFeeProposalManager
  );

  event CreateFundEighthStep(
    bytes32 fundId,
    address modifyMultiSigManagerDetailsProposalManager,
    address changeMultiSigWithdrawalLimitsProposalManager
  );

  enum Step {
    FIRST,
    SECOND,
    THIRD,
    FOURTH,
    FIFTH,
    SIXTH,
    SEVENTH,
    EIGHTH,
    DONE
  }

  struct FundContracts {
    address creator;
    address operator;
    Step currentStep;
    FundRA fundRA;
    FundMultiSig fundMultiSig;
    FundStorage fundStorage;
    FundController fundController;
  }

  bool initialized;

  uint256 public ethFee;
  uint256 public galtFee;
  address internal collector;

  GaltGlobalRegistry internal ggr;

  FundRAFactory fundRAFactory;
  FundStorageFactory fundStorageFactory;
  FundMultiSigFactory fundMultiSigFactory;
  FundControllerFactory fundControllerFactory;
  ModifyConfigProposalManagerFactory modifyConfigProposalManagerFactory;
  NewMemberProposalManagerFactory newMemberProposalManagerFactory;
  FineMemberProposalManagerFactory fineMemberProposalManagerFactory;
  ExpelMemberProposalManagerFactory expelMemberProposalManagerFactory;
  WLProposalManagerFactory wlProposalManagerFactory;
  ChangeNameAndDescriptionProposalManagerFactory changeNameAndDescriptionProposalManagerFactory;
  AddFundRuleProposalManagerFactory addFundRuleProposalManagerFactory;
  DeactivateFundRuleProposalManagerFactory deactivateFundRuleProposalManagerFactory;
  ChangeMultiSigOwnersProposalManagerFactory changeMultiSigOwnersProposalManagerFactory;
  ModifyFeeProposalManagerFactory modifyFeeProposalManagerFactory;
  ModifyMultiSigManagerDetailsProposalManagerFactory modifyMultiSigManagerDetailsProposalManagerFactory;
  ChangeMultiSigWithdrawalLimitsProposalManagerFactory changeMultiSigWithdrawalLimitsProposalManagerFactory;
  mapping(bytes32 => FundContracts) internal fundContracts;

  constructor (
    GaltGlobalRegistry _ggr,
    FundRAFactory _fundRAFactory,
    FundMultiSigFactory _fundMultiSigFactory,
    FundStorageFactory _fundStorageFactory,
    FundControllerFactory _fundControllerFactory
  ) public {
    galtFee = 10 ether;
    ethFee = 5 ether;

    ggr = _ggr;

    fundRAFactory = _fundRAFactory;
    fundStorageFactory = _fundStorageFactory;
    fundMultiSigFactory = _fundMultiSigFactory;
    fundControllerFactory = _fundControllerFactory;
  }

  // All the arguments don't fit into a stack limit of constructor,
  // so there is one more method for initialization
  function initialize(
    ModifyConfigProposalManagerFactory _modifyConfigProposalManagerFactory,
    NewMemberProposalManagerFactory _newMemberProposalManagerFactory,
    FineMemberProposalManagerFactory _fineMemberProposalManagerFactory,
    ExpelMemberProposalManagerFactory _expelMemberProposalManagerFactory,
    WLProposalManagerFactory _wlProposalManagerFactory,
    ChangeNameAndDescriptionProposalManagerFactory _changeNameAndDescriptionProposalManagerFactory,
    AddFundRuleProposalManagerFactory _addFundRuleProposalManagerFactory,
    DeactivateFundRuleProposalManagerFactory _deactivateFundRuleProposalManagerFactory,
    ChangeMultiSigOwnersProposalManagerFactory _changeMultiSigOwnersProposalManagerFactory,
    ModifyFeeProposalManagerFactory _modifyFeeProposalManagerFactory,
    ModifyMultiSigManagerDetailsProposalManagerFactory _modifyMultiSigManagerDetailsProposalManagerFactory,
    ChangeMultiSigWithdrawalLimitsProposalManagerFactory _changeMultiSigWithdrawalLimitsProposalManagerFactory
  )
    external
    onlyOwner
  {
    require (initialized == false);

    modifyConfigProposalManagerFactory = _modifyConfigProposalManagerFactory;
    newMemberProposalManagerFactory = _newMemberProposalManagerFactory;
    fineMemberProposalManagerFactory = _fineMemberProposalManagerFactory;
    expelMemberProposalManagerFactory = _expelMemberProposalManagerFactory;
    wlProposalManagerFactory = _wlProposalManagerFactory;
    changeNameAndDescriptionProposalManagerFactory = _changeNameAndDescriptionProposalManagerFactory;
    addFundRuleProposalManagerFactory = _addFundRuleProposalManagerFactory;
    deactivateFundRuleProposalManagerFactory = _deactivateFundRuleProposalManagerFactory;
    changeMultiSigOwnersProposalManagerFactory = _changeMultiSigOwnersProposalManagerFactory;
    modifyFeeProposalManagerFactory = _modifyFeeProposalManagerFactory;
    modifyMultiSigManagerDetailsProposalManagerFactory = _modifyMultiSigManagerDetailsProposalManagerFactory;
    changeMultiSigWithdrawalLimitsProposalManagerFactory = _changeMultiSigWithdrawalLimitsProposalManagerFactory;

    initialized = true;
  }

  function _acceptPayment() internal {
    if (msg.value == 0) {
      ggr.getGaltToken().transferFrom(msg.sender, address(this), galtFee);
    } else {
      require(msg.value == ethFee, "Fee and msg.value not equal");
    }
  }

  function buildFirstStep(
    address operator,
    bool _isPrivate,
    uint256[] calldata _thresholds,
    address[] calldata _initialMultiSigOwners,
    uint256 _initialMultiSigRequired,
    uint256 _periodLength
  )
    external
    payable
    returns (bytes32 fundId)
  {
    require(_thresholds.length == 12, "Thresholds length should be 12");

    fundId = keccak256(abi.encode(blockhash(block.number - 1), _initialMultiSigRequired, _initialMultiSigOwners, msg.sender));

    FundContracts storage c = fundContracts[fundId];
    require(c.currentStep == Step.FIRST, "Requires first step");

    _acceptPayment();

    FundStorage fundStorage = fundStorageFactory.build(
      ggr,
      _isPrivate,
      _thresholds,
      _periodLength
    );

    FundMultiSig fundMultiSig = fundMultiSigFactory.build(
      _initialMultiSigOwners,
      _initialMultiSigRequired,
      fundStorage
    );

    c.creator = msg.sender;
    c.operator = operator;
    c.fundStorage = fundStorage;
    c.fundMultiSig = fundMultiSig;

    c.currentStep = Step.SECOND;

    emit CreateFundFirstStep(fundId, address(fundMultiSig), address(fundStorage));

    return fundId;
  }

  function buildSecondStep(bytes32 _fundId) external {
    FundContracts storage c = fundContracts[_fundId];
    require(msg.sender == c.creator || msg.sender == c.operator, "Only creator/operator allowed");
    require(c.currentStep == Step.SECOND, "Requires second step");

    FundController fundController = fundControllerFactory.build(
      c.fundStorage
    );
    c.fundController = fundController;

    c.currentStep = Step.THIRD;

    emit CreateFundSecondStep(
      _fundId,
      address(fundController)
    );
  }

  function buildThirdStep(bytes32 _fundId) external {
    FundContracts storage c = fundContracts[_fundId];
    require(msg.sender == c.creator || msg.sender == c.operator, "Only creator/operator allowed");
    require(c.currentStep == Step.THIRD, "Requires third step");

    FundStorage _fundStorage = c.fundStorage;
    FundController _fundController = c.fundController;

    c.fundRA = fundRAFactory.build(_fundStorage);

    ModifyConfigProposalManager modifyConfigProposalManager = modifyConfigProposalManagerFactory.build(_fundStorage);
    NewMemberProposalManager newMemberProposalManager = newMemberProposalManagerFactory.build(_fundStorage);

    _fundStorage.addRoleTo(address(this), _fundStorage.CONTRACT_WHITELIST_MANAGER());
    _fundStorage.addWhiteListedContract(address(modifyConfigProposalManager), MODIFY_CONFIG_TYPE, 0x0, "");
    _fundStorage.addWhiteListedContract(address(newMemberProposalManager), NEW_MEMBER_TYPE, 0x0, "");
    _fundStorage.removeRoleFrom(address(this), _fundStorage.CONTRACT_WHITELIST_MANAGER());

    _fundStorage.addRoleTo(address(modifyConfigProposalManager), _fundStorage.CONTRACT_CONFIG_MANAGER());
    _fundStorage.addRoleTo(address(newMemberProposalManager), _fundStorage.CONTRACT_NEW_MEMBER_MANAGER());
    _fundStorage.addRoleTo(address(c.fundRA), _fundStorage.DECREMENT_TOKEN_REPUTATION_ROLE());
    _fundStorage.addRoleTo(address(_fundController), _fundStorage.CONTRACT_FINE_MEMBER_DECREMENT_MANAGER());

    c.currentStep = Step.FOURTH;

    emit CreateFundThirdStep(
      _fundId,
      address(c.fundRA),
      address(modifyConfigProposalManager),
      address(newMemberProposalManager)
    );
  }

  function buildFourthStep(bytes32 _fundId) external {
    FundContracts storage c = fundContracts[_fundId];
    require(msg.sender == c.creator || msg.sender == c.operator, "Only creator/operator allowed");
    require(c.currentStep == Step.FOURTH, "Requires fourth step");

    FundStorage _fundStorage = c.fundStorage;

    FineMemberProposalManager fineMemberProposalManager = fineMemberProposalManagerFactory.build(_fundStorage);
    WLProposalManager wlProposalManager = wlProposalManagerFactory.build(_fundStorage);
    ExpelMemberProposalManager expelMemberProposalManager = expelMemberProposalManagerFactory.build(_fundStorage);

    _fundStorage.addRoleTo(address(this), _fundStorage.CONTRACT_WHITELIST_MANAGER());
    _fundStorage.addWhiteListedContract(address(fineMemberProposalManager), FINE_MEMBER_TYPE, 0x0, "");
    _fundStorage.addWhiteListedContract(address(wlProposalManager), WHITE_LIST_TYPE, 0x0, "");
    _fundStorage.addWhiteListedContract(address(expelMemberProposalManager), EXPEL_MEMBER_TYPE, 0x0, "");
    _fundStorage.removeRoleFrom(address(this), _fundStorage.CONTRACT_WHITELIST_MANAGER());

    _fundStorage.addRoleTo(address(fineMemberProposalManager), _fundStorage.CONTRACT_FINE_MEMBER_INCREMENT_MANAGER());
    _fundStorage.addRoleTo(address(wlProposalManager), _fundStorage.CONTRACT_WHITELIST_MANAGER());
    _fundStorage.addRoleTo(address(expelMemberProposalManager), _fundStorage.CONTRACT_EXPEL_MEMBER_MANAGER());

    c.currentStep = Step.FIFTH;

    emit CreateFundFourthStep(
      _fundId,
      address(fineMemberProposalManager),
      address(wlProposalManager),
      address(expelMemberProposalManager)
    );
  }

  function buildFifthStep(bytes32 _fundId, string calldata _name, string calldata _description) external {
    FundContracts storage c = fundContracts[_fundId];
    require(msg.sender == c.creator || msg.sender == c.operator, "Only creator/operator allowed");
    require(c.currentStep == Step.FIFTH, "Requires fifth step");

    FundStorage _fundStorage = c.fundStorage;

    ChangeNameAndDescriptionProposalManager changeNameAndDescriptionProposalManager = changeNameAndDescriptionProposalManagerFactory
      .build(_fundStorage);

    _fundStorage.addRoleTo(address(changeNameAndDescriptionProposalManager), _fundStorage.CONTRACT_CHANGE_NAME_AND_DESCRIPTION_MANAGER());

    _fundStorage.addRoleTo(address(this), _fundStorage.CONTRACT_WHITELIST_MANAGER());
    _fundStorage.addWhiteListedContract(address(changeNameAndDescriptionProposalManager), CHANGE_NAME_AND_DESCRIPTION_TYPE, 0x0, "");
    _fundStorage.removeRoleFrom(address(this), _fundStorage.CONTRACT_WHITELIST_MANAGER());

    _fundStorage.addRoleTo(address(this), _fundStorage.CONTRACT_CHANGE_NAME_AND_DESCRIPTION_MANAGER());
    _fundStorage.setNameAndDescription(_name, _description);
    _fundStorage.removeRoleFrom(address(this), _fundStorage.CONTRACT_CHANGE_NAME_AND_DESCRIPTION_MANAGER());

    c.currentStep = Step.SIXTH;

    emit CreateFundFifthStep(
      _fundId,
      address(changeNameAndDescriptionProposalManager)
    );
  }

  function buildSixthStep(bytes32 _fundId, uint256[] calldata _initialSpaceTokensToApprove) external {
    FundContracts storage c = fundContracts[_fundId];
    require(msg.sender == c.creator || msg.sender == c.operator, "Only creator/operator allowed");
    require(c.currentStep == Step.SIXTH, "Requires sixth step");

    FundStorage _fundStorage = c.fundStorage;

    AddFundRuleProposalManager addFundRuleProposalManager = addFundRuleProposalManagerFactory.build(_fundStorage);
    DeactivateFundRuleProposalManager deactivateFundRuleProposalManager = deactivateFundRuleProposalManagerFactory.build(_fundStorage);

    _fundStorage.addRoleTo(address(addFundRuleProposalManager), _fundStorage.CONTRACT_ADD_FUND_RULE_MANAGER());
    _fundStorage.addRoleTo(address(deactivateFundRuleProposalManager), _fundStorage.CONTRACT_DEACTIVATE_FUND_RULE_MANAGER());

    _fundStorage.addRoleTo(address(this), _fundStorage.CONTRACT_WHITELIST_MANAGER());
    _fundStorage.addWhiteListedContract(address(addFundRuleProposalManager), ADD_FUND_RULE_TYPE, 0x0, "");
    _fundStorage.addWhiteListedContract(address(deactivateFundRuleProposalManager), DEACTIVATE_FUND_RULE_TYPE, 0x0, "");
    _fundStorage.removeRoleFrom(address(this), _fundStorage.CONTRACT_WHITELIST_MANAGER());
    
    _fundStorage.addRoleTo(address(this), _fundStorage.CONTRACT_NEW_MEMBER_MANAGER());

    for (uint i = 0; i < _initialSpaceTokensToApprove.length; i++) {
      _fundStorage.approveMint(_initialSpaceTokensToApprove[i]);
    }

    _fundStorage.removeRoleFrom(address(this), _fundStorage.CONTRACT_NEW_MEMBER_MANAGER());

    c.currentStep = Step.SEVENTH;

    emit CreateFundSixthStep(
      _fundId,
      address(addFundRuleProposalManager),
      address(deactivateFundRuleProposalManager)
    );
  }

  function buildSeventhStep(bytes32 _fundId) external {
    FundContracts storage c = fundContracts[_fundId];
    require(msg.sender == c.creator || msg.sender == c.operator, "Only creator/operator allowed");
    require(c.currentStep == Step.SEVENTH, "Requires seventh step");

    ChangeMultiSigOwnersProposalManager changeMultiSigOwnersProposalManager = changeMultiSigOwnersProposalManagerFactory.build(
      c.fundStorage
    );
    ModifyFeeProposalManager modifyFeeProposalManager = modifyFeeProposalManagerFactory.build(
      c.fundStorage
    );

    c.fundMultiSig.addRoleTo(address(changeMultiSigOwnersProposalManager), c.fundMultiSig.OWNER_MANAGER());
    c.fundStorage.addRoleTo(address(modifyFeeProposalManager), c.fundStorage.CONTRACT_FEE_MANAGER());

    c.fundStorage.addRoleTo(address(this), c.fundStorage.CONTRACT_WHITELIST_MANAGER());
    c.fundStorage.addWhiteListedContract(address(changeMultiSigOwnersProposalManager), CHANGE_MULTISIG_OWNERS_TYPE, 0x0, "");
    c.fundStorage.addWhiteListedContract(address(modifyFeeProposalManager), MODIFY_FEE_TYPE, 0x0, "");
    c.fundStorage.removeRoleFrom(address(this), c.fundStorage.CONTRACT_WHITELIST_MANAGER());

    c.currentStep = Step.EIGHTH;

    emit CreateFundSeventhStep(
      _fundId,
      address(changeMultiSigOwnersProposalManager),
      address(modifyFeeProposalManager)
    );
  }

  function buildEighthStep(bytes32 _fundId) external {
    FundContracts storage c = fundContracts[_fundId];
    require(msg.sender == c.creator || msg.sender == c.operator, "Only creator/operator allowed");
    require(c.currentStep == Step.EIGHTH, "Requires eighth step");

    ModifyMultiSigManagerDetailsProposalManager modifyMultiSigManagerDetailsProposalManager = modifyMultiSigManagerDetailsProposalManagerFactory.build(
      c.fundStorage
    );
    ChangeMultiSigWithdrawalLimitsProposalManager changeMultiSigWithdrawalLimitsProposalManager = changeMultiSigWithdrawalLimitsProposalManagerFactory.build(
      c.fundStorage
    );

    c.fundStorage.addRoleTo(address(modifyMultiSigManagerDetailsProposalManager), c.fundStorage.CONTRACT_MEMBER_DETAILS_MANAGER());
    c.fundStorage.addRoleTo(address(changeMultiSigWithdrawalLimitsProposalManager), c.fundStorage.CONTRACT_MULTI_SIG_WITHDRAWAL_LIMITS_MANAGER());

    c.fundStorage.addRoleTo(address(this), c.fundStorage.CONTRACT_WHITELIST_MANAGER());
    c.fundStorage.addWhiteListedContract(address(modifyMultiSigManagerDetailsProposalManager), MODIFY_MULTISIG_MANAGER_DETAILS_TYPE, 0x0, "");
    c.fundStorage.addWhiteListedContract(address(changeMultiSigWithdrawalLimitsProposalManager), CHANGE_MULTISIG_WITHDRAWAL_LIMIT_TYPE, 0x0, "");
    c.fundStorage.removeRoleFrom(address(this), c.fundStorage.CONTRACT_WHITELIST_MANAGER());

    c.fundStorage.initialize(
      c.fundMultiSig,
      c.fundController,
      c.fundRA
    );

    c.currentStep = Step.DONE;

    emit CreateFundEighthStep(
      _fundId,
      address(modifyMultiSigManagerDetailsProposalManager),
      address(changeMultiSigWithdrawalLimitsProposalManager)
    );
  }

  function setEthFee(uint256 _ethFee) external onlyOwner {
    ethFee = _ethFee;
  }

  function setGaltFee(uint256 _galtFee) external onlyOwner {
    galtFee = _galtFee;
  }

  function setCollectorAddress(address _collector) external onlyOwner {
    collector = _collector;
  }

  function getLastCreatedContracts(bytes32 _fundId) external view returns (
    address operator,
    Step currentStep,
    IFundRA fundRA,
    FundMultiSig fundMultiSig,
    FundStorage fundStorage,
    FundController fundController
  )
  {
    FundContracts storage c = fundContracts[_fundId];
    return (
      c.operator,
      c.currentStep,
      c.fundRA,
      c.fundMultiSig,
      c.fundStorage,
      c.fundController
    );
  }

  function getCurrentStep(bytes32 _fundId) external view returns (Step) {
    return fundContracts[_fundId].currentStep;
  }
}
