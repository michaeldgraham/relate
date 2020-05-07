import {Args, Mutation, Query, Resolver} from '@nestjs/graphql';
import {Inject} from '@nestjs/common';
import {SystemProvider} from '@relate/common';
import {ConfigService} from '@nestjs/config';

import {AppLaunchData, AppLaunchToken} from './models';
import {IWebModuleConfig} from '../web.module';
import {createAppLaunchUrl} from './apps.utils';

@Resolver(() => String)
export class AppsResolver {
    constructor(
        @Inject(ConfigService) private readonly configService: ConfigService<IWebModuleConfig>,
        @Inject(SystemProvider) protected readonly systemProvider: SystemProvider,
    ) {}

    @Query(() => AppLaunchData)
    async appLaunchData(
        @Args('appId') appId: string,
        @Args('launchToken') launchToken: string,
    ): Promise<AppLaunchData> {
        const {environmentId, dbmsId, ...rest} = await this.systemProvider.parseAppLaunchToken(appId, launchToken);
        const environment = await this.systemProvider.getEnvironment(environmentId);
        const dbms = await environment.getDbms(dbmsId);

        return {
            environmentId: environment.id,
            dbms,
            ...rest,
        };
    }

    @Mutation(() => AppLaunchToken)
    async createAppLaunchToken(
        @Args('environmentId') environmentId: string,
        @Args('appId') appId: string,
        @Args('dbmsId') dbmsId: string,
        @Args('principal') principal: string,
        @Args('accessToken') accessToken: string,
    ): Promise<AppLaunchToken> {
        const token = await this.systemProvider.createAppLaunchToken(
            environmentId,
            appId,
            dbmsId,
            principal,
            accessToken,
        );

        return {
            path: createAppLaunchUrl(this.configService.get('staticHTTPRoot'), appId, token),
            token,
        };
    }
}