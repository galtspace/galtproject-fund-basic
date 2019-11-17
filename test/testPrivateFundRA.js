const PPToken = artifacts.require('./PPToken.sol');
const GaltToken = artifacts.require('./GaltToken.sol');
const PPLockerRegistry = artifacts.require('./PPLockerRegistry.sol');
const PPTokenRegistry = artifacts.require('./PPTokenRegistry.sol');
const PPLockerFactory = artifacts.require('./PPLockerFactory.sol');
const PPTokenFactory = artifacts.require('./PPTokenFactory.sol');
const PPLocker = artifacts.require('./PPLocker.sol');
const PrivateRegularEthFee = artifacts.require('./PrivateRegularEthFee.sol');
const PrivateRegularEthFeeFactory = artifacts.require('./PrivateRegularEthFeeFactory.sol');
const PPGlobalRegistry = artifacts.require('./PPGlobalRegistry.sol');
const PPACL = artifacts.require('./PPACL.sol');

PPToken.numberFormat = 'String';
PPLocker.numberFormat = 'String';

const { deployFundFactory, buildPrivateFund } = require('./deploymentHelpers');
const { ether, assertRevert, initHelperWeb3, lastBlockTimestamp, increaseTime } = require('./helpers');

const { web3 } = PPToken;
const { utf8ToHex } = web3.utils;
const bytes32 = utf8ToHex;

initHelperWeb3(web3);

// 60 * 60
const ONE_HOUR = 3600;
// 60 * 60 * 24
const ONE_DAY = 86400;
// 60 * 60 * 24 * 30
const ONE_MONTH = 2592000;

contract('PrivateFundRA', accounts => {
  const [coreTeam, minter, alice, bob, charlie, unauthorized, lockerFeeManager] = accounts;

  const ethFee = ether(10);
  const galtFee = ether(20);

  const registryDataLink = 'bafyreihtjrn4lggo3qjvaamqihvgas57iwsozhpdr2al2uucrt3qoed3j1';

  before(async function() {
    this.galtToken = await GaltToken.new({ from: coreTeam });

    this.ppgr = await PPGlobalRegistry.new();
    this.acl = await PPACL.new();
    this.ppTokenRegistry = await PPTokenRegistry.new();
    this.ppLockerRegistry = await PPLockerRegistry.new();

    await this.ppgr.initialize();
    await this.ppTokenRegistry.initialize(this.ppgr.address);
    await this.ppLockerRegistry.initialize(this.ppgr.address);

    this.ppTokenFactory = await PPTokenFactory.new(this.ppgr.address, this.galtToken.address, 0, 0);
    this.ppLockerFactory = await PPLockerFactory.new(this.ppgr.address, this.galtToken.address, 0, 0);

    // PPGR setup
    await this.ppgr.setContract(await this.ppgr.PPGR_ACL(), this.acl.address);
    await this.ppgr.setContract(await this.ppgr.PPGR_TOKEN_REGISTRY(), this.ppTokenRegistry.address);
    await this.ppgr.setContract(await this.ppgr.PPGR_LOCKER_REGISTRY(), this.ppLockerRegistry.address);

    // ACL setup
    await this.acl.setRole(bytes32('TOKEN_REGISTRAR'), this.ppTokenFactory.address, true);
    await this.acl.setRole(bytes32('LOCKER_REGISTRAR'), this.ppLockerFactory.address, true);

    // Fees setup
    await this.ppTokenFactory.setFeeManager(lockerFeeManager);
    await this.ppTokenFactory.setEthFee(ethFee, { from: lockerFeeManager });
    await this.ppTokenFactory.setGaltFee(galtFee, { from: lockerFeeManager });

    await this.ppLockerFactory.setFeeManager(lockerFeeManager);
    await this.ppLockerFactory.setEthFee(ethFee, { from: lockerFeeManager });
    await this.ppLockerFactory.setGaltFee(galtFee, { from: lockerFeeManager });

    await this.galtToken.mint(alice, ether(10000000), { from: coreTeam });
    await this.galtToken.mint(bob, ether(10000000), { from: coreTeam });
    await this.galtToken.mint(charlie, ether(10000000), { from: coreTeam });

    // fund factory contracts
    this.fundFactory = await deployFundFactory(
      this.ppgr.address,
      alice,
      true,
      this.galtToken.address,
      ether(10),
      ether(20)
    );
  });

  beforeEach(async function() {
    // build fund
    await this.galtToken.approve(this.fundFactory.address, ether(100), { from: alice });
    const fund = await buildPrivateFund(this.fundFactory, alice, false, 600000, {}, [bob, charlie], 2);

    this.fundStorageX = fund.fundStorage;
    this.fundControllerX = fund.fundController;
    this.fundRAX = fund.fundRA;
    this.fundProposalManagerX = fund.fundProposalManager;

    // CREATE REGISTRIES
    let res = await this.ppTokenFactory.build('Buildings', 'BDL', registryDataLink, {
      from: coreTeam,
      value: ether(10)
    });
    this.registry1 = await PPToken.at(res.logs[4].args.token);

    res = await this.ppTokenFactory.build('Land Plots', 'PLT', registryDataLink, {
      from: coreTeam,
      value: ether(10)
    });
    this.registry2 = await PPToken.at(res.logs[4].args.token);

    res = await this.ppTokenFactory.build('Appartments', 'APS', registryDataLink, {
      from: coreTeam,
      value: ether(10)
    });
    this.registry3 = await PPToken.at(res.logs[4].args.token);

    await this.registry1.setMinter(minter);
    await this.registry2.setMinter(minter);
    await this.registry3.setMinter(minter);

    // MINT TOKENS
    res = await this.registry1.mint(alice, { from: minter });
    this.token1 = res.logs[0].args.privatePropertyId;
    res = await this.registry2.mint(bob, { from: minter });
    this.token2 = res.logs[0].args.privatePropertyId;
    res = await this.registry3.mint(charlie, { from: minter });
    this.token3 = res.logs[0].args.privatePropertyId;

    res = await this.registry1.ownerOf(this.token1);
    assert.equal(res, alice);
    res = await this.registry2.ownerOf(this.token2);
    assert.equal(res, bob);
    res = await this.registry3.ownerOf(this.token3);
    assert.equal(res, charlie);

    // HACK
    await this.registry1.setDetails(this.token1, 2, 1, 800, utf8ToHex('foo'), 'bar', 'buzz', { from: minter });
    await this.registry2.setDetails(this.token2, 2, 1, 0, utf8ToHex('foo'), 'bar', 'buzz', { from: minter });
    await this.registry3.setDetails(this.token3, 2, 1, 0, utf8ToHex('foo'), 'bar', 'buzz', { from: minter });

    // BUILD LOCKERS
    await this.galtToken.approve(this.ppLockerFactory.address, ether(20), { from: alice });
    res = await this.ppLockerFactory.build({ from: alice });
    this.aliceLockerAddress = res.logs[0].args.locker;

    await this.galtToken.approve(this.ppLockerFactory.address, ether(20), { from: bob });
    res = await this.ppLockerFactory.build({ from: bob });
    this.bobLockerAddress = res.logs[0].args.locker;

    await this.galtToken.approve(this.ppLockerFactory.address, ether(20), { from: charlie });
    res = await this.ppLockerFactory.build({ from: charlie });
    this.charlieLockerAddress = res.logs[0].args.locker;

    this.aliceLocker = await PPLocker.at(this.aliceLockerAddress);
    this.bobLocker = await PPLocker.at(this.bobLockerAddress);
    this.charlieLocker = await PPLocker.at(this.charlieLockerAddress);

    // APPROVE SPACE TOKEN
    await this.registry1.approve(this.aliceLockerAddress, this.token1, { from: alice });
    await this.registry2.approve(this.bobLockerAddress, this.token2, { from: bob });
    await this.registry3.approve(this.charlieLockerAddress, this.token3, { from: charlie });

    // DEPOSIT SPACE TOKEN
    await this.aliceLocker.deposit(this.registry1.address, this.token1, { from: alice });
    await this.bobLocker.deposit(this.registry2.address, this.token2, { from: bob });
    await this.charlieLocker.deposit(this.registry3.address, this.token3, { from: charlie });

    // APPROVE REPUTATION MINT
    await this.aliceLocker.approveMint(this.fundRAX.address, { from: alice });
    await this.bobLocker.approveMint(this.fundRAX.address, { from: bob });
    await this.charlieLocker.approveMint(this.fundRAX.address, { from: charlie });

    assert.equal(await this.aliceLocker.reputation(), 800);
    assert.equal(await this.aliceLocker.tokenId(), this.token1);
    assert.equal(await this.aliceLocker.tokenContract(), this.registry1.address);

    assert.equal(await this.bobLocker.reputation(), 0);
    assert.equal(await this.bobLocker.tokenId(), this.token2);
    assert.equal(await this.bobLocker.tokenContract(), this.registry2.address);

    await this.fundRAX.mint(this.aliceLockerAddress, { from: alice });
    await this.fundRAX.mint(this.bobLockerAddress, { from: bob });
    await this.fundRAX.mint(this.charlieLockerAddress, { from: charlie });
  });

  describe('lock', () => {
    it('should handle basic reputation transfer case', async function() {
      let res = await this.fundRAX.balanceOf(alice);
      assert.equal(res, 800);

      res = await lastBlockTimestamp();
      this.initialTimestamp = res + ONE_HOUR;
      this.regularEthFeeFactory = await PrivateRegularEthFeeFactory.new({ from: coreTeam });
      res = await this.regularEthFeeFactory.build(
        this.fundStorageX.address,
        this.initialTimestamp.toString(10),
        ONE_MONTH,
        ether(4)
      );
      this.feeAddress = res.logs[0].args.addr;
      this.regularEthFee = await PrivateRegularEthFee.at(this.feeAddress);

      const calldata = this.fundStorageX.contract.methods.addFeeContract(this.feeAddress).encodeABI();
      res = await this.fundProposalManagerX.propose(this.fundStorageX.address, 0, calldata, 'blah', {
        from: alice
      });
      const proposalId = res.logs[0].args.proposalId.toString(10);

      await this.fundProposalManagerX.aye(proposalId, { from: bob });
      await this.fundProposalManagerX.aye(proposalId, { from: charlie });
      await this.fundProposalManagerX.aye(proposalId, { from: alice });
      await this.fundProposalManagerX.triggerApprove(proposalId, { from: unauthorized });

      res = await this.fundStorageX.getFeeContracts();
      assert.sameMembers(res, [this.feeAddress]);

      await this.regularEthFee.lockToken(this.registry1.address, this.token1, { from: unauthorized });

      res = await this.fundStorageX.isTokenLocked(this.registry1.address, this.token1);
      assert.equal(res, true);

      assert.equal(await this.fundStorageX.isTokenLocked(this.registry1.address, this.token1), true);
      await assertRevert(this.fundRAX.approveBurn(this.aliceLockerAddress, { from: alice }), 'heck');

      await increaseTime(ONE_DAY + 2 * ONE_HOUR);
      await this.regularEthFee.pay(this.registry1.address, this.token1, { from: alice, value: ether(4) });

      await this.regularEthFee.unlockToken(this.registry1.address, this.token1, { from: unauthorized });
      this.fundRAX.approveBurn(this.aliceLockerAddress, { from: alice });
    });
  });

  describe('transfer', () => {
    it('should handle basic reputation transfer case', async function() {
      let res = await this.fundRAX.balanceOf(alice);
      assert.equal(res, 800);

      const block0 = (await web3.eth.getBlock('latest')).number;

      // TRANSFER #1
      await this.fundRAX.delegate(bob, alice, 350, { from: alice });
      const block1 = (await web3.eth.getBlock('latest')).number;

      res = await this.fundRAX.balanceOf(alice);
      assert.equal(res, 450);

      res = await this.fundRAX.balanceOf(bob);
      assert.equal(res, 350);

      // TRANSFER #2
      await this.fundRAX.delegate(charlie, alice, 100, { from: bob });
      const block2 = (await web3.eth.getBlock('latest')).number;

      res = await this.fundRAX.balanceOf(alice);
      assert.equal(res, 450);

      res = await this.fundRAX.balanceOf(bob);
      assert.equal(res, 250);

      res = await this.fundRAX.balanceOf(charlie);
      assert.equal(res, 100);

      // TRANSFER #3
      await this.fundRAX.delegate(alice, alice, 50, { from: charlie });
      const block3 = (await web3.eth.getBlock('latest')).number;

      res = await this.fundRAX.balanceOf(alice);
      assert.equal(res, 500);

      res = await this.fundRAX.balanceOf(bob);
      assert.equal(res, 250);

      res = await this.fundRAX.balanceOf(charlie);
      assert.equal(res, 50);

      // REVOKE #1
      await this.fundRAX.revoke(bob, 200, { from: alice });
      const block4 = (await web3.eth.getBlock('latest')).number;

      await assertRevert(this.fundRAX.revoke(bob, 200, { from: charlie }));
      await assertRevert(this.fundRAX.revoke(alice, 200, { from: charlie }));

      res = await this.fundRAX.balanceOf(alice);
      assert.equal(res, 700);

      res = await this.fundRAX.balanceOf(bob);
      assert.equal(res, 50);

      res = await this.fundRAX.balanceOf(charlie);
      assert.equal(res, 50);

      // BURN REPUTATION UNSUCCESSFUL ATTEMPTS
      await assertRevert(this.fundRAX.approveBurn(this.aliceLockerAddress, { from: alice }));

      // UNSUCCESSFUL WITHDRAW SPACE TOKEN
      await assertRevert(this.aliceLocker.burn(this.fundRAX.address, { from: alice }));
      await assertRevert(this.aliceLocker.withdraw({ from: alice }));

      // REVOKE REPUTATION
      await this.fundRAX.revoke(bob, 50, { from: alice });
      await this.fundRAX.revoke(charlie, 50, { from: alice });
      const block5 = (await web3.eth.getBlock('latest')).number;

      res = await this.fundRAX.balanceOf(alice);
      assert.equal(res, 800);

      res = await this.fundRAX.balanceOf(bob);
      assert.equal(res, 0);

      res = await this.fundRAX.balanceOf(charlie);
      assert.equal(res, 0);

      // WITHDRAW TOKEN
      await assertRevert(this.fundRAX.approveBurn(this.aliceLockerAddress, { from: charlie }));
      await this.fundRAX.approveBurn(this.aliceLockerAddress, { from: alice });
      const block6 = (await web3.eth.getBlock('latest')).number;

      await this.aliceLocker.burn(this.fundRAX.address, { from: alice });
      await this.aliceLocker.withdraw({ from: alice });

      res = await this.fundRAX.balanceOf(alice);
      assert.equal(res, 0);

      res = await this.aliceLocker.reputation();
      assert.equal(res, 0);

      res = await this.aliceLocker.owner();
      assert.equal(res, alice);

      res = await this.aliceLocker.tokenId();
      assert.equal(res, 0);

      res = await this.aliceLocker.tokenDeposited();
      assert.equal(res, false);

      res = await this.ppLockerRegistry.isValid(this.aliceLockerAddress);
      assert.equal(res, true);

      // CHECK CACHED BALANCES
      res = await this.fundRAX.balanceOfAt(alice, block0);
      assert.equal(res, 800);
      res = await this.fundRAX.balanceOfAt(bob, block0);
      assert.equal(res, 0);
      res = await this.fundRAX.balanceOfAt(charlie, block0);
      assert.equal(res, 0);

      res = await this.fundRAX.balanceOfAt(alice, block1);
      assert.equal(res, 450);
      res = await this.fundRAX.balanceOfAt(bob, block1);
      assert.equal(res, 350);
      res = await this.fundRAX.balanceOfAt(charlie, block1);
      assert.equal(res, 0);

      res = await this.fundRAX.balanceOfAt(alice, block2);
      assert.equal(res, 450);
      res = await this.fundRAX.balanceOfAt(bob, block2);
      assert.equal(res, 250);
      res = await this.fundRAX.balanceOfAt(charlie, block2);
      assert.equal(res, 100);

      res = await this.fundRAX.balanceOfAt(alice, block3);
      assert.equal(res, 500);
      res = await this.fundRAX.balanceOfAt(bob, block3);
      assert.equal(res, 250);
      res = await this.fundRAX.balanceOfAt(charlie, block3);
      assert.equal(res, 50);

      res = await this.fundRAX.balanceOfAt(alice, block4);
      assert.equal(res, 700);
      res = await this.fundRAX.balanceOfAt(bob, block4);
      assert.equal(res, 50);
      res = await this.fundRAX.balanceOfAt(charlie, block4);
      assert.equal(res, 50);

      res = await this.fundRAX.balanceOfAt(alice, block5);
      assert.equal(res, 800);
      res = await this.fundRAX.balanceOfAt(bob, block5);
      assert.equal(res, 0);
      res = await this.fundRAX.balanceOfAt(charlie, block5);
      assert.equal(res, 0);

      res = await this.fundRAX.balanceOfAt(alice, block6);
      assert.equal(res, 0);
      res = await this.fundRAX.balanceOfAt(bob, block6);
      assert.equal(res, 0);
      res = await this.fundRAX.balanceOfAt(charlie, block6);
      assert.equal(res, 0);
    });
  });
});