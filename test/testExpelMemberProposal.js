const { accounts, defaultSender, contract, web3 } = require('@openzeppelin/test-environment');
const { assert } = require('chai');

const SpaceToken = contract.fromArtifact('SpaceToken');
const GaltToken = contract.fromArtifact('GaltToken');
const LockerRegistry = contract.fromArtifact('LockerRegistry');
const SpaceLockerFactory = contract.fromArtifact('SpaceLockerFactory');
const SpaceLocker = contract.fromArtifact('SpaceLocker');
const MockSpaceGeoDataRegistry = contract.fromArtifact('MockSpaceGeoDataRegistry');
const GaltGlobalRegistry = contract.fromArtifact('GaltGlobalRegistry');
const FeeRegistry = contract.fromArtifact('FeeRegistry');
const ACL = contract.fromArtifact('ACL');
const FundFactory = contract.fromArtifact('FundFactory');

const { deployFundFactory, buildFund, VotingConfig } = require('./deploymentHelpers');
const { ether, assertRevert, initHelperWeb3, paymentMethods, evmIncreaseTime, zeroAddress } = require('./helpers');

const { utf8ToHex } = web3.utils;
const bytes32 = utf8ToHex;

initHelperWeb3(web3);

const ProposalStatus = {
  NULL: 0,
  ACTIVE: 1,
  EXECUTED: 2
};

describe('ExpelFundMemberProposal', () => {
  const [alice, bob, charlie, dan, eve, frank, minter, geoDateManagement, unauthorized] = accounts;
  const coreTeam = defaultSender;

  before(async function() {
    this.galtToken = await GaltToken.new({ from: coreTeam });
    this.ggr = await GaltGlobalRegistry.new({ from: coreTeam });
    this.acl = await ACL.new({ from: coreTeam });
    this.spaceGeoDataRegistry = await MockSpaceGeoDataRegistry.new({ from: coreTeam });
    this.spaceToken = await SpaceToken.new(this.ggr.address, 'Name', 'Symbol', { from: coreTeam });
    this.lockerRegistry = await LockerRegistry.new(this.ggr.address, bytes32('SPACE_LOCKER_REGISTRAR'), {
      from: coreTeam
    });
    this.feeRegistry = await FeeRegistry.new({ from: coreTeam });

    await this.ggr.setContract(await this.ggr.ACL(), this.acl.address, { from: coreTeam });
    await this.ggr.setContract(await this.ggr.FEE_REGISTRY(), this.feeRegistry.address, { from: coreTeam });
    await this.ggr.setContract(await this.ggr.SPACE_TOKEN(), this.spaceToken.address, { from: coreTeam });
    await this.ggr.setContract(await this.ggr.GALT_TOKEN(), this.galtToken.address, { from: coreTeam });
    await this.ggr.setContract(await this.ggr.SPACE_GEO_DATA_REGISTRY(), this.spaceGeoDataRegistry.address, {
      from: coreTeam
    });
    await this.ggr.setContract(await this.ggr.SPACE_LOCKER_REGISTRY(), this.lockerRegistry.address, {
      from: coreTeam
    });

    this.spaceLockerFactory = await SpaceLockerFactory.new(this.ggr.address, { from: coreTeam });
    await this.feeRegistry.setGaltFee(await this.spaceLockerFactory.FEE_KEY(), ether(10), { from: coreTeam });
    await this.feeRegistry.setEthFee(await this.spaceLockerFactory.FEE_KEY(), ether(5), { from: coreTeam });
    await this.feeRegistry.setPaymentMethod(await this.spaceLockerFactory.FEE_KEY(), paymentMethods.ETH_AND_GALT, {
      from: coreTeam
    });

    await this.acl.setRole(bytes32('SPACE_MINTER'), minter, true);
    await this.acl.setRole(bytes32('SPACE_LOCKER_REGISTRAR'), this.spaceLockerFactory.address, true, {
      from: coreTeam
    });

    // assign roles
    await this.galtToken.mint(alice, ether(10000000), { from: coreTeam });

    // fund factory contracts
    this.fundFactory = await deployFundFactory(FundFactory, this.ggr.address, alice);
  });

  beforeEach(async function() {
    // build fund
    await this.galtToken.approve(this.fundFactory.address, ether(100), { from: alice });
    const fund = await buildFund(
      this.fundFactory,
      alice,
      false,
      new VotingConfig(ether(60), ether(40), VotingConfig.ONE_WEEK, 0),
      {},
      [bob, charlie, dan],
      2
    );

    this.fundStorageX = fund.fundStorage;
    this.fundControllerX = fund.fundController;
    this.fundRAX = fund.fundRA;
    this.fundProposalManagerX = fund.fundProposalManager;

    this.beneficiaries = [bob, charlie, dan, eve, frank];
    this.benefeciarSpaceTokens = ['1', '2', '3', '4', '5'];
    await this.fundRAX.mintAllHack(this.beneficiaries, this.benefeciarSpaceTokens, 300, { from: alice });
  });

  describe('proposal pipeline', () => {
    it('should allow user who has reputation creating a new proposal', async function() {
      let res = await this.spaceToken.mint(alice, { from: minter });
      const token1 = res.logs[0].args.tokenId.toNumber();

      res = await this.spaceToken.ownerOf(token1);
      assert.equal(res, alice);

      // HACK
      await this.spaceGeoDataRegistry.setArea(token1, 800, { from: geoDateManagement });

      await this.galtToken.approve(this.spaceLockerFactory.address, ether(10), { from: alice });
      res = await this.spaceLockerFactory.build({ from: alice });
      const lockerAddress = res.logs[0].args.locker;

      const locker = await SpaceLocker.at(lockerAddress);

      // DEPOSIT SPACE TOKEN
      await this.spaceToken.approve(lockerAddress, token1, { from: alice });
      await locker.deposit(token1, { from: alice });

      res = await locker.reputation();
      assert.equal(res, 800);

      res = await locker.owner();
      assert.equal(res, alice);

      res = await locker.spaceTokenId();
      assert.equal(res, 0);

      res = await locker.tokenDeposited();
      assert.equal(res, true);

      res = await this.lockerRegistry.isValid(lockerAddress);
      assert.equal(res, true);

      // MINT REPUTATION
      await locker.approveMint(this.fundRAX.address, { from: alice });
      await assertRevert(this.fundRAX.mint(lockerAddress, { from: minter }));
      await this.fundRAX.mint(lockerAddress, { from: alice });

      // res = await this.fundRAX.spaceTokenOwners();
      // assert.sameMembers(res, [alice, bob, charlie, dan, eve, frank]);

      // DISTRIBUTE REPUTATION
      await this.fundRAX.delegate(bob, alice, 300, { from: alice });
      await this.fundRAX.delegate(charlie, alice, 100, { from: bob });
      const block0 = (await web3.eth.getBlock('latest')).number;

      await assertRevert(this.fundRAX.burnExpelled(token1, bob, alice, 200, { from: unauthorized }));

      // EXPEL
      const proposalData = this.fundStorageX.contract.methods.expel(token1).encodeABI();
      res = await this.fundProposalManagerX.propose(
        this.fundStorageX.address,
        0,
        false,
        false,
        false,
        zeroAddress,
        proposalData,
        'blah',
        {
          from: charlie
        }
      );

      const proposalId = res.logs[0].args.proposalId.toString(10);
      res = await this.fundRAX.totalSupplyAt(block0);
      assert.equal(res, 2300); // 300 * 5 + 800

      res = await this.fundProposalManagerX.proposals(proposalId);
      assert.equal(res.dataLink, 'blah');

      await this.fundProposalManagerX.aye(proposalId, false, { from: bob });
      await this.fundProposalManagerX.aye(proposalId, false, { from: charlie });
      await this.fundProposalManagerX.aye(proposalId, false, { from: dan });
      await this.fundProposalManagerX.aye(proposalId, false, { from: eve });

      res = await this.fundRAX.totalSupply();
      assert.equal(res, 2300); // 300 * 5 + 800
      res = await this.fundRAX.balanceOf(bob);
      assert.equal(res, 500);
      res = await this.fundRAX.balanceOfAt(bob, block0);
      assert.equal(res, 500);
      res = await this.fundRAX.spaceTokenOwnersCount();
      assert.equal(res, 6);
      res = await this.fundRAX.isMember(alice);
      assert.equal(res, true);
      res = await this.fundRAX.ownerHasSpaceToken(alice, token1);
      assert.equal(res, true);

      res = await this.fundProposalManagerX.getProposalVoting(proposalId);
      assert.equal(res.totalAyes, 1500); // 500 + 400 + 300 + 300
      assert.equal(res.totalNays, 0);

      res = await this.fundProposalManagerX.getProposalVotingProgress(proposalId);
      assert.equal(res.ayesShare, '65217391304347826086');
      assert.equal(res.currentSupport, ether(100));
      assert.equal(res.requiredSupport, ether(60));
      assert.equal(res.minAcceptQuorum, ether(40));

      res = await this.fundStorageX.getExpelledToken(token1);
      assert.equal(res.isExpelled, false);
      assert.equal(res.amount, 0);

      await evmIncreaseTime(VotingConfig.ONE_WEEK + 1);

      // ACCEPT PROPOSAL
      await this.fundProposalManagerX.executeProposal(proposalId, 0);

      res = await this.fundStorageX.getExpelledToken(token1);
      assert.equal(res.isExpelled, true);
      assert.equal(res.amount, 800);

      res = await this.fundProposalManagerX.proposals(proposalId);
      assert.equal(res.status, ProposalStatus.EXECUTED);

      // BURNING LOCKED REPUTATION FOR EXPELLED TOKEN
      await assertRevert(this.fundRAX.burnExpelled(token1, charlie, alice, 101, { from: unauthorized }));
      await this.fundRAX.burnExpelled(token1, charlie, alice, 100, { from: unauthorized });
      await assertRevert(this.fundRAX.burnExpelled(token1, bob, alice, 201, { from: unauthorized }));
      await this.fundRAX.burnExpelled(token1, bob, alice, 200, { from: unauthorized });
      await assertRevert(this.fundRAX.burnExpelled(token1, alice, alice, 501, { from: unauthorized }));
      await this.fundRAX.burnExpelled(token1, alice, alice, 500, { from: unauthorized });

      res = await this.fundStorageX.getExpelledToken(token1);
      assert.equal(res.isExpelled, true);
      assert.equal(res.amount, 0);

      res = await this.fundRAX.balanceOf(alice);
      assert.equal(res, 0);
      res = await this.fundRAX.delegatedBalanceOf(alice, alice);
      assert.equal(res, 0);
      res = await this.fundRAX.ownedBalanceOf(alice);
      assert.equal(res, 0);
      res = await this.fundRAX.totalSupply();
      assert.equal(res, 1500); // 300 * 5
      res = await this.fundRAX.spaceTokenOwnersCount();
      assert.equal(res, 5);
      res = await this.fundRAX.isMember(alice);
      assert.equal(res, false);
      res = await this.fundRAX.ownerHasSpaceToken(alice, token1);
      assert.equal(res, false);

      // MINT REPUTATION REJECTED
      await assertRevert(this.fundRAX.mint(lockerAddress, { from: alice }));

      // BURN
      await locker.burn(this.fundRAX.address, { from: alice });

      // MINT REPUTATION REJECTED AFTER BURN
      await locker.approveMint(this.fundRAX.address, { from: alice });
      await assertRevert(this.fundRAX.mint(lockerAddress, { from: alice }));
    });
  });
});
