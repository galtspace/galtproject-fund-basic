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

pragma solidity 0.5.7;

import "openzeppelin-solidity/contracts/token/ERC721/IERC721.sol";
import "@galtproject/core/contracts/interfaces/ISpaceLocker.sol";
import "./AbstractFundProposalManager.sol";
import "../FundStorage.sol";


contract ExpelMemberProposalManager is AbstractFundProposalManager {
  struct Proposal {
    uint256 spaceTokenId;
    string description;
  }

  mapping(uint256 => Proposal) private _proposals;

  constructor(
    FundStorage _fundStorage
  )
    public
    AbstractFundProposalManager(_fundStorage)
  {
  }

  function propose(uint256 _spaceTokenId, string calldata _description) external {
    uint256 id = idCounter.next();

    _proposals[id] = Proposal({
      spaceTokenId: _spaceTokenId,
      description: _description
    });

    emit NewProposal(id, msg.sender);
    _onNewProposal(id);

    ProposalVoting storage proposalVoting = _proposalVotings[id];

    proposalVoting.status = ProposalStatus.ACTIVE;
  }

  function _execute(uint256 _proposalId) internal {
    Proposal storage p = _proposals[_proposalId];

    address owner = fundStorage.ggr().getSpaceToken().ownerOf(p.spaceTokenId);
    uint256 amount = ISpaceLocker(owner).reputation();

    assert(amount > 0);

    fundStorage.expel(p.spaceTokenId, amount);
  }

  function getThreshold() public view returns (uint256) {
    return uint256(fundStorage.getConfigValue(fundStorage.EXPEL_MEMBER_THRESHOLD()));
  }

  function getProposal(uint256 _proposalId) external view returns (uint256 spaceTokenId, string memory description) {
    Proposal storage p = _proposals[_proposalId];

    return (p.spaceTokenId, p.description);
  }
}
