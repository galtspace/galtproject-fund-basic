const SpaceToken = artifacts.require('./SpaceToken.sol');
const GaltToken = artifacts.require('./GaltToken.sol');

const { deployFundFactory, buildFund } = require('./deploymentHelpers');
const { ether, assertRevert, initHelperWeb3 } = require('./helpers');

const { web3 } = SpaceToken;

initHelperWeb3(web3);

const ProposalStatus = {
  NULL: 0,
  ACTIVE: 1,
  APPROVED: 2,
  REJECTED: 3
};

contract('Fee Proposals', accounts => {
  const [coreTeam, alice, bob, charlie, dan, eve, frank, spaceLockerRegistryAddress] = accounts;

  beforeEach(async function() {
    this.spaceToken = await SpaceToken.new('Name', 'Symbol', { from: coreTeam });
    this.galtToken = await GaltToken.new({ from: coreTeam });

    // assign roles
    await this.galtToken.mint(alice, ether(10000000), { from: coreTeam });

    // fund factory contracts
    const fundFactory = await deployFundFactory(
      this.galtToken.address,
      this.spaceToken.address,
      spaceLockerRegistryAddress,
      alice
    );

    // build fund
    await this.galtToken.approve(fundFactory.address, ether(100), { from: alice });
    const fund = await buildFund(
      fundFactory,
      alice,
      false,
      [60, 50, 60, 60, 60, 60, 60, 60, 60, 60],
      [bob, charlie, dan],
      2
    );

    this.fundStorageX = fund.fundStorage;
    this.fundControllerX = fund.fundController;
    this.fundMultiSigX = fund.fundMultiSigX;
    this.rsraX = fund.fundRsra;
    this.expelMemberProposalManagerX = fund.expelMemberProposalManager;
    this.modifyConfigProposalManagerX = fund.modifyConfigProposalManager;
    this.addFundRuleProposalManagerX = fund.addFundRuleProposalManager;
    this.deactivateFundRuleProposalManagerX = fund.deactivateFundRuleProposalManager;
    this.modifyFeeProposalManager = fund.modifyFeeProposalManager;

    this.beneficiaries = [bob, charlie, dan, eve, frank];
    this.benefeciarSpaceTokens = ['1', '2', '3', '4', '5'];
  });

  describe('Create Fee Proposal', () => {
    it('should encode', async function() {
      await this.rsraX.mintAll(this.beneficiaries, this.benefeciarSpaceTokens, 300, { from: alice });

      const feeContract = alice;
      const calldata = this.fundStorageX.contract.methods.addFeeContract(feeContract).encodeABI();
      let res = await this.modifyFeeProposalManager.propose(calldata, 'Have a new list', {
        from: bob
      });

      const proposalId = res.logs[0].args.proposalId.toString(10);

      await this.modifyFeeProposalManager.aye(proposalId, { from: bob });
      await this.modifyFeeProposalManager.nay(proposalId, { from: charlie });

      res = await this.modifyFeeProposalManager.getProposalVoting(proposalId);
      assert.sameMembers(res.ayes, [bob]);
      assert.sameMembers(res.nays, [charlie]);

      assert.equal(res.status, ProposalStatus.ACTIVE);

      res = await this.modifyFeeProposalManager.getActiveProposals();
      assert.sameMembers(res.map(a => a.toNumber(10)), [1]);
      res = await this.modifyFeeProposalManager.getApprovedProposals();
      assert.sameMembers(res.map(a => a.toNumber(10)), []);
      res = await this.modifyFeeProposalManager.getRejectedProposals();
      assert.sameMembers(res.map(a => a.toNumber(10)), []);

      res = await this.modifyFeeProposalManager.getAyeShare(proposalId);
      assert.equal(res, 20);
      res = await this.modifyFeeProposalManager.getNayShare(proposalId);
      assert.equal(res, 20);

      // Deny double-vote
      await assertRevert(this.modifyFeeProposalManager.aye(proposalId, { from: bob }));
      await assertRevert(this.modifyFeeProposalManager.triggerReject(proposalId, { from: dan }));

      await this.modifyFeeProposalManager.aye(proposalId, { from: dan });
      await this.modifyFeeProposalManager.aye(proposalId, { from: eve });

      res = await this.modifyFeeProposalManager.getAyeShare(proposalId);
      assert.equal(res, 60);
      res = await this.modifyFeeProposalManager.getNayShare(proposalId);
      assert.equal(res, 20);

      // await this.modifyFeeProposalManager.triggerApprove(proposalId, { from: dan });
      //
      // res = await this.changeMultiSigOwnersProposalManager.getProposalVoting(proposalId);
      // assert.equal(res.status, ProposalStatus.APPROVED);
      //
      // res = await this.changeMultiSigOwnersProposalManager.getActiveProposals();
      // assert.sameMembers(res.map(a => a.toNumber(10)), []);
      // res = await this.changeMultiSigOwnersProposalManager.getApprovedProposals();
      // assert.sameMembers(res.map(a => a.toNumber(10)), [1]);
      // res = await this.changeMultiSigOwnersProposalManager.getRejectedProposals();
      // assert.sameMembers(res.map(a => a.toNumber(10)), []);
      //
      // // verify value changed
      // res = await this.fundMultiSig.getOwners();
      // assert.sameMembers(res, [alice, frank, george]);
    });
  });
});