import { mcdMaker, setupCollateral } from '../helpers';
import { takeSnapshot, restoreSnapshot } from '@makerdao/test-helpers';
import { ETH, MDAI } from '../../src';
import { ServiceRoles } from '../../src/constants';
import BigNumber from 'bignumber.js';

import schemas, {
  TOTAL_SAVINGS_DAI,
  SAVINGS_DAI_BY_PROXY,
  DAI_SAVINGS_RATE,
  ANNUAL_DAI_SAVINGS_RATE,
  DATE_EARNINGS_LAST_ACCRUED
} from '../../src/schemas';

let maker, snapshotData, cdpMgr, saveService;

const ETH_A_COLLATERAL_AMOUNT = ETH(1);
const ETH_A_DEBT_AMOUNT = MDAI(1);
const ETH_A_PRICE = 180;

beforeAll(async () => {
  maker = await mcdMaker({
    cdpTypes: [{ currency: ETH, ilk: 'ETH-A' }],
    multicall: true
  });

  snapshotData = await takeSnapshot(maker);
  maker.service('multicall').createWatcher({ interval: 'block' });
  maker.service('multicall').registerSchemas(schemas);
  maker.service('multicall').start();
  await setupCollateral(maker, 'ETH-A', {
    price: ETH_A_PRICE
  });

  cdpMgr = await maker.service(ServiceRoles.CDP_MANAGER);
  saveService = await maker.service(ServiceRoles.SAVINGS);

  const dai = maker.getToken(MDAI);
  const _proxyAddress = await maker.service('proxy').ensureProxy();
  await dai.approveUnlimited(_proxyAddress);

  await cdpMgr.openLockAndDraw(
    'ETH-A',
    ETH_A_COLLATERAL_AMOUNT,
    ETH_A_DEBT_AMOUNT
  );

  await saveService.join(MDAI(1));
});

afterAll(async () => {
  await restoreSnapshot(snapshotData, maker);
});

test(TOTAL_SAVINGS_DAI, async () => {
  const totalSavingsDai = await maker.latest(TOTAL_SAVINGS_DAI);
  expect(totalSavingsDai.symbol).toEqual('CHAI');
  expect(totalSavingsDai.toNumber()).toBeCloseTo(0.99995);
});

test(SAVINGS_DAI_BY_PROXY, async () => {
  const savingsDaiByProxy = await maker.latest(
    SAVINGS_DAI_BY_PROXY,
    await maker.service('proxy').getProxyAddress()
  );
  expect(savingsDaiByProxy.symbol).toEqual('CHAI');
  expect(savingsDaiByProxy.toNumber()).toBeCloseTo(0.99995);
});

test(DAI_SAVINGS_RATE, async () => {
  const daiSavingsRate = await maker.latest(DAI_SAVINGS_RATE);
  expect(daiSavingsRate).toEqual(BigNumber('1.000000000315522921573372069'));
});

test(ANNUAL_DAI_SAVINGS_RATE, async () => {
  const annualDaiSavingsRate = await maker.latest(ANNUAL_DAI_SAVINGS_RATE);
  expect(annualDaiSavingsRate).toEqual(
    BigNumber(
      '0.999999999999999998903600959584714938425430352632298919434159277685511322388082342817131189583694'
    )
  );
});

test(DATE_EARNINGS_LAST_ACCRUED, async () => {
  const timestamp = Math.round(new Date().getTime() / 1000);
  const dateEarningsLastAccrued = await maker.latest(
    DATE_EARNINGS_LAST_ACCRUED
  );

  expect(dateEarningsLastAccrued instanceof Date).toEqual(true);
  expect(timestamp - dateEarningsLastAccrued).toBeLessThanOrEqual(10);
});