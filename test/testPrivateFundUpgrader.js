const { accounts, defaultSender, contract, web3 } = require('@openzeppelin/test-environment');
const { assert } = require('chai');

const PPToken = contract.fromArtifact('PPToken');
const GaltToken = contract.fromArtifact('GaltToken');
const PPLocker = contract.fromArtifact('PPLocker');
const PPGlobalRegistry = contract.fromArtifact('PPGlobalRegistry');
const PPACL = contract.fromArtifact('PPACL');
const MockUpgradeScript1 = contract.fromArtifact('MockUpgradeScript1');
const MockUpgradeScript2 = contract.fromArtifact('MockUpgradeScript2');
const MockFundProposalManagerV2 = contract.fromArtifact('MockFundProposalManagerV2');
const IOwnedUpgradeabilityProxy = contract.fromArtifact('IOwnedUpgradeabilityProxy');
const PrivateFundFactory = contract.fromArtifact('PrivateFundFactory');
const EthFeeRegistry = contract.fromArtifact('EthFeeRegistry');

PPToken.numberFormat = 'String';
PPLocker.numberFormat = 'String';
MockUpgradeScript1.numberFormat = 'String';

const { deployFundFactory, buildPrivateFund, VotingConfig } = require('./deploymentHelpers');
const { ether, initHelperWeb3, assertRevert, zeroAddress } = require('./helpers');

initHelperWeb3(web3);

const ProposalStatus = {
  NULL: 0,
  ACTIVE: 1,
  EXECUTED: 2
};

describe('PrivateFundUpgrader', () => {
  const [alice, bob, charlie, dan, eve, frank, feeManager, fakeRegistry] = accounts;
  const coreTeam = defaultSender;

  before(async function() {
    this.galtToken = await GaltToken.new({ from: coreTeam });

    this.ppgr = await PPGlobalRegistry.new();
    this.acl = await PPACL.new();
    this.ppFeeRegistry = await EthFeeRegistry.new();

    await this.ppgr.initialize();
    await this.ppFeeRegistry.initialize(feeManager, feeManager, [], []);

    await this.ppgr.setContract(await this.ppgr.PPGR_GALT_TOKEN(), this.galtToken.address);
    await this.ppgr.setContract(await this.ppgr.PPGR_FEE_REGISTRY(), this.ppFeeRegistry.address);
    await this.galtToken.mint(alice, ether(10000000), { from: coreTeam });

    // fund factory contracts
    this.fundFactory = await deployFundFactory(
      PrivateFundFactory,
      this.ppgr.address,
      alice,
      true,
      ether(10),
      ether(20)
    );
  });

  beforeEach(async function() {
    // build fund
    await this.galtToken.approve(this.fundFactory.address, ether(100), { from: alice });
    const fund = await buildPrivateFund(
      this.fundFactory,
      alice,
      false,
      new VotingConfig(ether(60), ether(40), VotingConfig.ONE_WEEK, 0),
      {},
      [bob, charlie],
      2
    );

    this.fundStorageX = fund.fundStorage;
    this.fundRegistryX = fund.fundRegistry;
    this.fundControllerX = fund.fundController;
    this.fundRAX = fund.fundRA;
    this.fundUpgraderX = fund.fundUpgrader;
    this.fundProposalManagerX = fund.fundProposalManager;
    this.fundACLX = fund.fundACL;

    this.registries = [fakeRegistry, fakeRegistry, fakeRegistry, fakeRegistry, fakeRegistry];
    this.beneficiaries = [bob, charlie, dan, eve, frank];
    this.benefeciarSpaceTokens = ['1', '2', '3', '4', '5'];

    await this.fundRAX.mintAllHack(this.beneficiaries, this.registries, this.benefeciarSpaceTokens, 300, {
      from: alice
    });
  });

  it('should allow updating FundRegistry and FundACL records', async function() {
    const u1 = await MockUpgradeScript1.new(eve, dan);

    assert.equal(await this.fundUpgraderX.fundRegistry(), this.fundRegistryX.address);
    assert.equal(await this.fundUpgraderX.nextUpgradeScript(), zeroAddress);

    const payload = this.fundUpgraderX.contract.methods.setNextUpgradeScript(u1.address).encodeABI();
    const res = await this.fundProposalManagerX.propose(
      this.fundUpgraderX.address,
      0,
      false,
      false,
      false,
      zeroAddress,
      payload,
      'some data',
      {
        from: bob
      }
    );
    const proposalId = res.logs[0].args.proposalId.toString(10);

    await this.fundProposalManagerX.aye(proposalId, true, { from: bob });
    await this.fundProposalManagerX.aye(proposalId, true, { from: charlie });
    await this.fundProposalManagerX.aye(proposalId, true, { from: dan });

    assert.equal(await this.fundUpgraderX.nextUpgradeScript(), u1.address);

    // before
    assert.equal(await this.fundACLX.hasRole(eve, await this.fundStorageX.ROLE_CONFIG_MANAGER()), false);
    assert.equal(await this.fundRegistryX.getControllerAddress(), this.fundControllerX.address);

    await this.fundUpgraderX.upgrade();

    // check executed
    assert.equal(await this.fundUpgraderX.nextUpgradeScript(), zeroAddress);

    // after
    assert.equal(await this.fundACLX.hasRole(eve, await this.fundStorageX.ROLE_CONFIG_MANAGER()), true);
    assert.equal(await this.fundRegistryX.getControllerAddress(), dan);
  });

  it('should allow updating  contract by updating proxy implementation using script', async function() {
    const proposalManagerImplementationV2 = await MockFundProposalManagerV2.new();
    const proposalManagerV2 = await MockFundProposalManagerV2.at(this.fundProposalManagerX.address);
    const u2 = await MockUpgradeScript2.new(proposalManagerImplementationV2.address, 'fooV2');
    const proxy = await IOwnedUpgradeabilityProxy.at(this.fundProposalManagerX.address);

    assert.equal(await this.fundUpgraderX.nextUpgradeScript(), zeroAddress);

    const payload = this.fundUpgraderX.contract.methods.setNextUpgradeScript(u2.address).encodeABI();
    let res = await this.fundProposalManagerX.propose(
      this.fundUpgraderX.address,
      0,
      false,
      false,
      false,
      zeroAddress,
      payload,
      'some data',
      {
        from: bob
      }
    );
    const proposalId = res.logs[0].args.proposalId.toString(10);

    await this.fundProposalManagerX.aye(proposalId, true, { from: bob });
    await this.fundProposalManagerX.aye(proposalId, true, { from: charlie });
    await this.fundProposalManagerX.aye(proposalId, true, { from: dan });

    assert.equal(await this.fundUpgraderX.nextUpgradeScript(), u2.address);

    // before
    await assertRevert(proposalManagerV2.foo(), 'blah');

    await this.fundUpgraderX.upgrade();

    // check executed
    assert.equal(await this.fundUpgraderX.nextUpgradeScript(), zeroAddress);

    // after
    assert.equal(await proxy.implementation(), proposalManagerImplementationV2.address);
    res = await proposalManagerV2.foo();
    assert.equal(res.oldValue, this.fundRegistryX.address);
    assert.equal(res.newValue, 'fooV2');
  });

  it('should allow updating proposalManager by updating proxy implementation using direct call', async function() {
    const proposalManagerImplementationV2 = await MockFundProposalManagerV2.new();
    const proposalManagerV2 = await MockFundProposalManagerV2.at(this.fundProposalManagerX.address);
    const proxy = await IOwnedUpgradeabilityProxy.at(this.fundProposalManagerX.address);

    assert.equal(await this.fundUpgraderX.nextUpgradeScript(), zeroAddress);

    const initializePayload = proposalManagerImplementationV2.contract.methods.initialize3('fooV2').encodeABI();
    const payload = this.fundUpgraderX.contract.methods
      .upgradeImplementationToAndCall(proxy.address, proposalManagerImplementationV2.address, initializePayload)
      .encodeABI();
    let res = await this.fundProposalManagerX.propose(
      this.fundUpgraderX.address,
      0,
      false,
      false,
      false,
      zeroAddress,
      payload,
      'some data',
      {
        from: bob
      }
    );
    const proposalId = res.logs[0].args.proposalId.toString(10);

    // before
    assert.equal(await this.fundUpgraderX.nextUpgradeScript(), zeroAddress);
    await assertRevert(proposalManagerV2.foo(), 'blah');

    await this.fundProposalManagerX.aye(proposalId, true, { from: bob });
    await this.fundProposalManagerX.aye(proposalId, true, { from: charlie });
    await this.fundProposalManagerX.aye(proposalId, true, { from: dan });

    res = await this.fundProposalManagerX.proposals(proposalId);
    assert.equal(res.status, ProposalStatus.EXECUTED);

    // after
    assert.equal(await proxy.implementation(), proposalManagerImplementationV2.address);
    res = await proposalManagerV2.foo();
    assert.equal(res.oldValue, this.fundRegistryX.address);
    assert.equal(res.newValue, 'fooV2');
  });
});
