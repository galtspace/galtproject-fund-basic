const { accounts, contract, web3 } = require('@openzeppelin/test-environment');
const { assert } = require('chai');

const FundImplementationRegistry = contract.fromArtifact('FundImplementationRegistry');

const { initHelperWeb3, zeroAddress } = require('./helpers');

initHelperWeb3(web3);

FundImplementationRegistry.numberFormat = 'String';

const { utf8ToHex } = web3.utils;
const bytes32 = utf8ToHex;

describe('Fund Implementation Registry', () => {
  const [alice, bob, charlie, dan] = accounts;

  const code1 = bytes32('code1');
  const code2 = bytes32('code2');
  const code3 = bytes32('code3');
  let registry;

  it('should respond with 0s with no implementation', async function() {
    registry = await FundImplementationRegistry.new();

    await registry.addVersion(code2, alice);
    await registry.addVersion(code3, bob);
    await registry.addVersion(code3, charlie);
    await registry.addVersion(code3, dan);

    assert.equal(await registry.getLatestVersionNumber(code1), 0);
    assert.equal(await registry.getLatestVersionAddress(code1), zeroAddress);
    assert.sameMembers(await registry.getVersions(code1), []);

    assert.equal(await registry.getLatestVersionNumber(code2), 1);
    assert.equal(await registry.getLatestVersionAddress(code2), alice);
    assert.sameMembers(await registry.getVersions(code2), [zeroAddress, alice]);

    assert.equal(await registry.getLatestVersionNumber(code3), 3);
    assert.equal(await registry.getLatestVersionAddress(code3), dan);
    assert.sameMembers(await registry.getVersions(code3), [zeroAddress, bob, charlie, dan]);
  });

  it('should respond with 0s with no implementation', async function() {
    registry = await FundImplementationRegistry.new();

    await registry.addVersionList([code2, code3], [alice, bob]);
    await registry.addVersion(code3, charlie);
    await registry.addVersion(code3, dan);

    assert.equal(await registry.getLatestVersionNumber(code1), 0);
    assert.equal(await registry.getLatestVersionAddress(code1), zeroAddress);
    assert.sameMembers(await registry.getVersions(code1), []);

    assert.equal(await registry.getLatestVersionNumber(code2), 1);
    assert.equal(await registry.getLatestVersionAddress(code2), alice);
    assert.sameMembers(await registry.getVersions(code2), [zeroAddress, alice]);

    assert.equal(await registry.getLatestVersionNumber(code3), 3);
    assert.equal(await registry.getLatestVersionAddress(code3), dan);
    assert.sameMembers(await registry.getVersions(code3), [zeroAddress, bob, charlie, dan]);
  });
});
