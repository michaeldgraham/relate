import path from 'path';
import {List} from '@relate/types';

import {envPaths} from '../../utils';
import {InvalidArgumentError, NotFoundError, NotSupportedError} from '../../errors';
import * as versionUtils from '../../utils/dbmss/dbms-versions';
import * as downloadUtils from '../../utils/dbmss/download-neo4j';
import {TestDbmss} from '../../utils/system';
import {DBMS_DIR_NAME, DBMS_STATUS} from '../../constants';

const UUID_REGEX = /^[0-9A-F]{8}-[0-9A-F]{4}-[4][0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/i;
const INSTALL_ROOT = path.join(envPaths().data, DBMS_DIR_NAME);
const {ARCHIVE_PATH, NEO4J_VERSION} = TestDbmss;

describe('LocalDbmss - install', () => {
    let testDbmss: TestDbmss;

    beforeAll(async () => {
        testDbmss = await TestDbmss.init(__filename);
    });

    afterAll(() => testDbmss.teardown());

    afterEach(() => jest.restoreAllMocks());

    test('with no version', async () => {
        await expect(testDbmss.environment.dbmss.install(testDbmss.createName(), '')).rejects.toThrow(
            new InvalidArgumentError('Version must be specified'),
        );
    });

    test('with invalid version', async () => {
        await expect(
            testDbmss.environment.dbmss.install(testDbmss.createName(), 'notAVersionUrlOrFilePath'),
        ).rejects.toThrow(new InvalidArgumentError('Provided version argument is not valid semver, url or path.'));
    });

    test('with valid version (URL)', async () => {
        await expect(
            testDbmss.environment.dbmss.install(testDbmss.createName(), 'https://valid.url.com'),
        ).rejects.toThrow(new NotSupportedError('fetch and install https://valid.url.com'));
    });

    test('with not existing version (file path)', async () => {
        const message = 'Provided version argument is not valid semver, url or path.';

        await expect(
            testDbmss.environment.dbmss.install(testDbmss.createName(), path.join('non', 'existing', 'path')),
        ).rejects.toThrow(new InvalidArgumentError(message));
    });

    test('with valid version (file path)', async () => {
        const {id: dbmsID} = await testDbmss.environment.dbmss.install(testDbmss.createName(), ARCHIVE_PATH);
        expect(dbmsID).toMatch(UUID_REGEX);

        const message = await testDbmss.environment.dbmss.get(dbmsID);
        expect(message.status).toContain(DBMS_STATUS.STOPPED);

        const info = await versionUtils.getDistributionInfo(path.join(INSTALL_ROOT, `dbms-${dbmsID}`));
        expect(info?.version).toEqual(NEO4J_VERSION);
    });

    test('with version in unsupported range (semver)', async () => {
        await expect(testDbmss.environment.dbmss.install(testDbmss.createName(), '3.1')).rejects.toThrow(
            new NotSupportedError('version not in range >=3.4'),
        );
    });

    test('with valid, non cached version (semver)', async () => {
        // initially mock appearance of no downloaded neo4j dists
        const discoverNeo4jDistributionsSpy = jest
            .spyOn(versionUtils, 'discoverNeo4jDistributions')
            .mockImplementationOnce(() => Promise.resolve(List.from([])));
        jest.spyOn(downloadUtils, 'downloadNeo4j').mockImplementation(() => Promise.resolve());

        const {id: dbmsId} = await testDbmss.environment.dbmss.install(testDbmss.createName(), NEO4J_VERSION);

        expect(discoverNeo4jDistributionsSpy).toHaveBeenCalledTimes(2);

        const message = (await testDbmss.environment.dbmss.info([dbmsId])).toArray();
        expect(message[0].status).toContain(DBMS_STATUS.STOPPED);

        const info = await versionUtils.getDistributionInfo(path.join(INSTALL_ROOT, `dbms-${dbmsId}`));
        expect(info?.version).toEqual(NEO4J_VERSION);
    });

    test('with invalid, non cached version (semver)', async () => {
        const message = `Unable to find the requested version: ${NEO4J_VERSION}-${TestDbmss.NEO4J_EDITION} online`;
        jest.spyOn(versionUtils, 'discoverNeo4jDistributions').mockImplementation(() => Promise.resolve(List.from([])));
        jest.spyOn(downloadUtils, 'downloadNeo4j').mockImplementation(() => Promise.resolve());

        await expect(testDbmss.environment.dbmss.install(testDbmss.createName(), NEO4J_VERSION)).rejects.toThrow(
            new NotFoundError(message),
        );
    });

    test('with valid version (semver)', async () => {
        const {id: dbmsId} = await testDbmss.environment.dbmss.install(testDbmss.createName(), NEO4J_VERSION);

        const message = (await testDbmss.environment.dbmss.info([dbmsId])).toArray();
        expect(message[0].status).toContain(DBMS_STATUS.STOPPED);

        const info = await versionUtils.getDistributionInfo(path.join(INSTALL_ROOT, `dbms-${dbmsId}`));
        expect(info?.version).toEqual(NEO4J_VERSION);

        const {id: dbmsId2} = await testDbmss.environment.dbmss.install(testDbmss.createName(), NEO4J_VERSION);

        const message2 = (await testDbmss.environment.dbmss.info([dbmsId2])).toArray();
        expect(message2[0].status).toContain(DBMS_STATUS.STOPPED);

        const info2 = await versionUtils.getDistributionInfo(path.join(INSTALL_ROOT, `dbms-${dbmsId2}`));
        expect(info2?.version).toEqual(NEO4J_VERSION);
    });

    test('Has valid neo4j.conf, without leading commas in values', async () => {
        const {id: dbmsId} = await testDbmss.environment.dbmss.install(testDbmss.createName(), NEO4J_VERSION);
        const config = await testDbmss.environment.dbmss.getDbmsConfig(dbmsId);

        expect(config.get('dbms.security.procedures.unrestricted')).toEqual('jwt.security.*');
    });
});
