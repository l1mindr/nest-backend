'use strict';

customElements.define('compodoc-menu', class extends HTMLElement {
    constructor() {
        super();
        this.isNormalMode = this.getAttribute('mode') === 'normal';
    }

    connectedCallback() {
        this.render(this.isNormalMode);
    }

    render(isNormalMode) {
        let tp = lithtml.html(`
        <nav>
            <ul class="list">
                <li class="title">
                    <a href="index.html" data-type="index-link">nest-backend documentation</a>
                </li>

                <li class="divider"></li>
                ${ isNormalMode ? `<div id="book-search-input" role="search"><input type="text" placeholder="Type to search"></div>` : '' }
                <li class="chapter">
                    <a data-type="chapter-link" href="index.html"><span class="icon ion-ios-home"></span>Getting started</a>
                    <ul class="links">
                                <li class="link">
                                    <a href="overview.html" data-type="chapter-link">
                                        <span class="icon ion-ios-keypad"></span>Overview
                                    </a>
                                </li>

                            <li class="link">
                                <a href="index.html" data-type="chapter-link">
                                    <span class="icon ion-ios-paper"></span>
                                        README
                                </a>
                            </li>
                                <li class="link">
                                    <a href="dependencies.html" data-type="chapter-link">
                                        <span class="icon ion-ios-list"></span>Dependencies
                                    </a>
                                </li>
                                <li class="link">
                                    <a href="properties.html" data-type="chapter-link">
                                        <span class="icon ion-ios-apps"></span>Properties
                                    </a>
                                </li>

                    </ul>
                </li>
                    <li class="chapter modules">
                        <a data-type="chapter-link" href="modules.html">
                            <div class="menu-toggler linked" data-bs-toggle="collapse" ${ isNormalMode ?
                                'data-bs-target="#modules-links"' : 'data-bs-target="#xs-modules-links"' }>
                                <span class="icon ion-ios-archive"></span>
                                <span class="link-name">Modules</span>
                                <span class="icon ion-ios-arrow-down"></span>
                            </div>
                        </a>
                        <ul class="links collapse " ${ isNormalMode ? 'id="modules-links"' : 'id="xs-modules-links"' }>
                            <li class="link">
                                <a href="modules/AppModule.html" data-type="entity-link" >AppModule</a>
                            </li>
                            <li class="link">
                                <a href="modules/AuthModule.html" data-type="entity-link" >AuthModule</a>
                                    <li class="chapter inner">
                                        <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ?
                                            'data-bs-target="#controllers-links-module-AuthModule-c6a8113ffac9943cb1c92733a3bb24b0e68b4e237ca27d030f87c9e2399ec7088ead7d3dcdcfc954d122aab91b782fee7d9a408663a27e61fc632ab59a8be392"' : 'data-bs-target="#xs-controllers-links-module-AuthModule-c6a8113ffac9943cb1c92733a3bb24b0e68b4e237ca27d030f87c9e2399ec7088ead7d3dcdcfc954d122aab91b782fee7d9a408663a27e61fc632ab59a8be392"' }>
                                            <span class="icon ion-md-swap"></span>
                                            <span>Controllers</span>
                                            <span class="icon ion-ios-arrow-down"></span>
                                        </div>
                                        <ul class="links collapse" ${ isNormalMode ? 'id="controllers-links-module-AuthModule-c6a8113ffac9943cb1c92733a3bb24b0e68b4e237ca27d030f87c9e2399ec7088ead7d3dcdcfc954d122aab91b782fee7d9a408663a27e61fc632ab59a8be392"' :
                                            'id="xs-controllers-links-module-AuthModule-c6a8113ffac9943cb1c92733a3bb24b0e68b4e237ca27d030f87c9e2399ec7088ead7d3dcdcfc954d122aab91b782fee7d9a408663a27e61fc632ab59a8be392"' }>
                                            <li class="link">
                                                <a href="controllers/AuthController.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >AuthController</a>
                                            </li>
                                        </ul>
                                    </li>
                                <li class="chapter inner">
                                    <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ?
                                        'data-bs-target="#injectables-links-module-AuthModule-c6a8113ffac9943cb1c92733a3bb24b0e68b4e237ca27d030f87c9e2399ec7088ead7d3dcdcfc954d122aab91b782fee7d9a408663a27e61fc632ab59a8be392"' : 'data-bs-target="#xs-injectables-links-module-AuthModule-c6a8113ffac9943cb1c92733a3bb24b0e68b4e237ca27d030f87c9e2399ec7088ead7d3dcdcfc954d122aab91b782fee7d9a408663a27e61fc632ab59a8be392"' }>
                                        <span class="icon ion-md-arrow-round-down"></span>
                                        <span>Injectables</span>
                                        <span class="icon ion-ios-arrow-down"></span>
                                    </div>
                                    <ul class="links collapse" ${ isNormalMode ? 'id="injectables-links-module-AuthModule-c6a8113ffac9943cb1c92733a3bb24b0e68b4e237ca27d030f87c9e2399ec7088ead7d3dcdcfc954d122aab91b782fee7d9a408663a27e61fc632ab59a8be392"' :
                                        'id="xs-injectables-links-module-AuthModule-c6a8113ffac9943cb1c92733a3bb24b0e68b4e237ca27d030f87c9e2399ec7088ead7d3dcdcfc954d122aab91b782fee7d9a408663a27e61fc632ab59a8be392"' }>
                                        <li class="link">
                                            <a href="injectables/AuthService.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >AuthService</a>
                                        </li>
                                        <li class="link">
                                            <a href="injectables/BcryptProvider.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >BcryptProvider</a>
                                        </li>
                                    </ul>
                                </li>
                            </li>
                            <li class="link">
                                <a href="modules/ClockModule.html" data-type="entity-link" >ClockModule</a>
                                <li class="chapter inner">
                                    <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ?
                                        'data-bs-target="#injectables-links-module-ClockModule-cb11f09ea865184cda926d3453071642fc6586fe206a3178c98632543b849d482f2af732cd4725bd383829f8434e4444036018c942622ccf15c793ae8ca0d2d4"' : 'data-bs-target="#xs-injectables-links-module-ClockModule-cb11f09ea865184cda926d3453071642fc6586fe206a3178c98632543b849d482f2af732cd4725bd383829f8434e4444036018c942622ccf15c793ae8ca0d2d4"' }>
                                        <span class="icon ion-md-arrow-round-down"></span>
                                        <span>Injectables</span>
                                        <span class="icon ion-ios-arrow-down"></span>
                                    </div>
                                    <ul class="links collapse" ${ isNormalMode ? 'id="injectables-links-module-ClockModule-cb11f09ea865184cda926d3453071642fc6586fe206a3178c98632543b849d482f2af732cd4725bd383829f8434e4444036018c942622ccf15c793ae8ca0d2d4"' :
                                        'id="xs-injectables-links-module-ClockModule-cb11f09ea865184cda926d3453071642fc6586fe206a3178c98632543b849d482f2af732cd4725bd383829f8434e4444036018c942622ccf15c793ae8ca0d2d4"' }>
                                        <li class="link">
                                            <a href="injectables/ClockService.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >ClockService</a>
                                        </li>
                                    </ul>
                                </li>
                            </li>
                            <li class="link">
                                <a href="modules/CommonModule.html" data-type="entity-link" >CommonModule</a>
                                <li class="chapter inner">
                                    <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ?
                                        'data-bs-target="#injectables-links-module-CommonModule-3577a330b491d35b721cdbaab696274d7e7b535e9c96e2d5dbced2a48413707c213710067f60fc1eeb4cc08bf519f8a69e863b0e5e10ba1702c6815a52ab1fa9"' : 'data-bs-target="#xs-injectables-links-module-CommonModule-3577a330b491d35b721cdbaab696274d7e7b535e9c96e2d5dbced2a48413707c213710067f60fc1eeb4cc08bf519f8a69e863b0e5e10ba1702c6815a52ab1fa9"' }>
                                        <span class="icon ion-md-arrow-round-down"></span>
                                        <span>Injectables</span>
                                        <span class="icon ion-ios-arrow-down"></span>
                                    </div>
                                    <ul class="links collapse" ${ isNormalMode ? 'id="injectables-links-module-CommonModule-3577a330b491d35b721cdbaab696274d7e7b535e9c96e2d5dbced2a48413707c213710067f60fc1eeb4cc08bf519f8a69e863b0e5e10ba1702c6815a52ab1fa9"' :
                                        'id="xs-injectables-links-module-CommonModule-3577a330b491d35b721cdbaab696274d7e7b535e9c96e2d5dbced2a48413707c213710067f60fc1eeb4cc08bf519f8a69e863b0e5e10ba1702c6815a52ab1fa9"' }>
                                        <li class="link">
                                            <a href="injectables/DataResponseInterceptor.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >DataResponseInterceptor</a>
                                        </li>
                                    </ul>
                                </li>
                            </li>
                            <li class="link">
                                <a href="modules/CoreModule.html" data-type="entity-link" >CoreModule</a>
                            </li>
                            <li class="link">
                                <a href="modules/DatabasesModule.html" data-type="entity-link" >DatabasesModule</a>
                            </li>
                            <li class="link">
                                <a href="modules/DeviceModule.html" data-type="entity-link" >DeviceModule</a>
                                <li class="chapter inner">
                                    <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ?
                                        'data-bs-target="#injectables-links-module-DeviceModule-324b732d58a8b8e7e2537d00ac0134a5f623e818afaa5637f76115592c3fff26479deca4953042be8677b587943802b0a8a006ac8edc03e22d2a5dda89cd95c1"' : 'data-bs-target="#xs-injectables-links-module-DeviceModule-324b732d58a8b8e7e2537d00ac0134a5f623e818afaa5637f76115592c3fff26479deca4953042be8677b587943802b0a8a006ac8edc03e22d2a5dda89cd95c1"' }>
                                        <span class="icon ion-md-arrow-round-down"></span>
                                        <span>Injectables</span>
                                        <span class="icon ion-ios-arrow-down"></span>
                                    </div>
                                    <ul class="links collapse" ${ isNormalMode ? 'id="injectables-links-module-DeviceModule-324b732d58a8b8e7e2537d00ac0134a5f623e818afaa5637f76115592c3fff26479deca4953042be8677b587943802b0a8a006ac8edc03e22d2a5dda89cd95c1"' :
                                        'id="xs-injectables-links-module-DeviceModule-324b732d58a8b8e7e2537d00ac0134a5f623e818afaa5637f76115592c3fff26479deca4953042be8677b587943802b0a8a006ac8edc03e22d2a5dda89cd95c1"' }>
                                        <li class="link">
                                            <a href="injectables/DeviceDetectorService.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >DeviceDetectorService</a>
                                        </li>
                                        <li class="link">
                                            <a href="injectables/DeviceMapper.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >DeviceMapper</a>
                                        </li>
                                        <li class="link">
                                            <a href="injectables/FingerprintService.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >FingerprintService</a>
                                        </li>
                                        <li class="link">
                                            <a href="injectables/UserAgentParser.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >UserAgentParser</a>
                                        </li>
                                    </ul>
                                </li>
                            </li>
                            <li class="link">
                                <a href="modules/EnvModule.html" data-type="entity-link" >EnvModule</a>
                            </li>
                            <li class="link">
                                <a href="modules/FeaturesModule.html" data-type="entity-link" >FeaturesModule</a>
                            </li>
                            <li class="link">
                                <a href="modules/InfrastructureModule.html" data-type="entity-link" >InfrastructureModule</a>
                            </li>
                            <li class="link">
                                <a href="modules/PostgresModule.html" data-type="entity-link" >PostgresModule</a>
                            </li>
                            <li class="link">
                                <a href="modules/RedisModule.html" data-type="entity-link" >RedisModule</a>
                                <li class="chapter inner">
                                    <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ?
                                        'data-bs-target="#injectables-links-module-RedisModule-0c64ca60b8393270b31e0dfb71b665a7f565d192ea91012eb6cbbcfe377ae804a3810297516207fb371897542552aa09fe44388afbd736f960a6ef1d56b2f0a8"' : 'data-bs-target="#xs-injectables-links-module-RedisModule-0c64ca60b8393270b31e0dfb71b665a7f565d192ea91012eb6cbbcfe377ae804a3810297516207fb371897542552aa09fe44388afbd736f960a6ef1d56b2f0a8"' }>
                                        <span class="icon ion-md-arrow-round-down"></span>
                                        <span>Injectables</span>
                                        <span class="icon ion-ios-arrow-down"></span>
                                    </div>
                                    <ul class="links collapse" ${ isNormalMode ? 'id="injectables-links-module-RedisModule-0c64ca60b8393270b31e0dfb71b665a7f565d192ea91012eb6cbbcfe377ae804a3810297516207fb371897542552aa09fe44388afbd736f960a6ef1d56b2f0a8"' :
                                        'id="xs-injectables-links-module-RedisModule-0c64ca60b8393270b31e0dfb71b665a7f565d192ea91012eb6cbbcfe377ae804a3810297516207fb371897542552aa09fe44388afbd736f960a6ef1d56b2f0a8"' }>
                                        <li class="link">
                                            <a href="injectables/RedisLockService.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >RedisLockService</a>
                                        </li>
                                        <li class="link">
                                            <a href="injectables/RedisService.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >RedisService</a>
                                        </li>
                                    </ul>
                                </li>
                            </li>
                            <li class="link">
                                <a href="modules/SecurityModule.html" data-type="entity-link" >SecurityModule</a>
                                <li class="chapter inner">
                                    <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ?
                                        'data-bs-target="#injectables-links-module-SecurityModule-286e797dcd62dc255d2de50c903e5b78ea90207a894bcce2da8c150cba048c8cf48a4e5df815b2082833481e9412e403bdb3f42cd25ceab519fddc4e51f2a656"' : 'data-bs-target="#xs-injectables-links-module-SecurityModule-286e797dcd62dc255d2de50c903e5b78ea90207a894bcce2da8c150cba048c8cf48a4e5df815b2082833481e9412e403bdb3f42cd25ceab519fddc4e51f2a656"' }>
                                        <span class="icon ion-md-arrow-round-down"></span>
                                        <span>Injectables</span>
                                        <span class="icon ion-ios-arrow-down"></span>
                                    </div>
                                    <ul class="links collapse" ${ isNormalMode ? 'id="injectables-links-module-SecurityModule-286e797dcd62dc255d2de50c903e5b78ea90207a894bcce2da8c150cba048c8cf48a4e5df815b2082833481e9412e403bdb3f42cd25ceab519fddc4e51f2a656"' :
                                        'id="xs-injectables-links-module-SecurityModule-286e797dcd62dc255d2de50c903e5b78ea90207a894bcce2da8c150cba048c8cf48a4e5df815b2082833481e9412e403bdb3f42cd25ceab519fddc4e51f2a656"' }>
                                        <li class="link">
                                            <a href="injectables/JwtStrategy.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >JwtStrategy</a>
                                        </li>
                                    </ul>
                                </li>
                            </li>
                            <li class="link">
                                <a href="modules/SessionsModule.html" data-type="entity-link" >SessionsModule</a>
                                    <li class="chapter inner">
                                        <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ?
                                            'data-bs-target="#controllers-links-module-SessionsModule-de6fb0ca609097633496ae3dceecfd07b2ae517a47b31c2d2160c47652b1934a84f2db0636f80c2babcdea0adb6a7a35c316b55ce88625a3b6061bae7bbc5709"' : 'data-bs-target="#xs-controllers-links-module-SessionsModule-de6fb0ca609097633496ae3dceecfd07b2ae517a47b31c2d2160c47652b1934a84f2db0636f80c2babcdea0adb6a7a35c316b55ce88625a3b6061bae7bbc5709"' }>
                                            <span class="icon ion-md-swap"></span>
                                            <span>Controllers</span>
                                            <span class="icon ion-ios-arrow-down"></span>
                                        </div>
                                        <ul class="links collapse" ${ isNormalMode ? 'id="controllers-links-module-SessionsModule-de6fb0ca609097633496ae3dceecfd07b2ae517a47b31c2d2160c47652b1934a84f2db0636f80c2babcdea0adb6a7a35c316b55ce88625a3b6061bae7bbc5709"' :
                                            'id="xs-controllers-links-module-SessionsModule-de6fb0ca609097633496ae3dceecfd07b2ae517a47b31c2d2160c47652b1934a84f2db0636f80c2babcdea0adb6a7a35c316b55ce88625a3b6061bae7bbc5709"' }>
                                            <li class="link">
                                                <a href="controllers/SessionsController.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >SessionsController</a>
                                            </li>
                                        </ul>
                                    </li>
                                <li class="chapter inner">
                                    <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ?
                                        'data-bs-target="#injectables-links-module-SessionsModule-de6fb0ca609097633496ae3dceecfd07b2ae517a47b31c2d2160c47652b1934a84f2db0636f80c2babcdea0adb6a7a35c316b55ce88625a3b6061bae7bbc5709"' : 'data-bs-target="#xs-injectables-links-module-SessionsModule-de6fb0ca609097633496ae3dceecfd07b2ae517a47b31c2d2160c47652b1934a84f2db0636f80c2babcdea0adb6a7a35c316b55ce88625a3b6061bae7bbc5709"' }>
                                        <span class="icon ion-md-arrow-round-down"></span>
                                        <span>Injectables</span>
                                        <span class="icon ion-ios-arrow-down"></span>
                                    </div>
                                    <ul class="links collapse" ${ isNormalMode ? 'id="injectables-links-module-SessionsModule-de6fb0ca609097633496ae3dceecfd07b2ae517a47b31c2d2160c47652b1934a84f2db0636f80c2babcdea0adb6a7a35c316b55ce88625a3b6061bae7bbc5709"' :
                                        'id="xs-injectables-links-module-SessionsModule-de6fb0ca609097633496ae3dceecfd07b2ae517a47b31c2d2160c47652b1934a84f2db0636f80c2babcdea0adb6a7a35c316b55ce88625a3b6061bae7bbc5709"' }>
                                        <li class="link">
                                            <a href="injectables/SessionsService.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >SessionsService</a>
                                        </li>
                                    </ul>
                                </li>
                            </li>
                            <li class="link">
                                <a href="modules/TokenModule.html" data-type="entity-link" >TokenModule</a>
                                <li class="chapter inner">
                                    <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ?
                                        'data-bs-target="#injectables-links-module-TokenModule-a2ce5dd79f6d41fd4ed1f0980edd7019a553d2a5b27e0e9c24a057d0f3338ccb2dcd06e836d33537f90029f3237e9e7af99104903adbc26821f42cbe8b195c22"' : 'data-bs-target="#xs-injectables-links-module-TokenModule-a2ce5dd79f6d41fd4ed1f0980edd7019a553d2a5b27e0e9c24a057d0f3338ccb2dcd06e836d33537f90029f3237e9e7af99104903adbc26821f42cbe8b195c22"' }>
                                        <span class="icon ion-md-arrow-round-down"></span>
                                        <span>Injectables</span>
                                        <span class="icon ion-ios-arrow-down"></span>
                                    </div>
                                    <ul class="links collapse" ${ isNormalMode ? 'id="injectables-links-module-TokenModule-a2ce5dd79f6d41fd4ed1f0980edd7019a553d2a5b27e0e9c24a057d0f3338ccb2dcd06e836d33537f90029f3237e9e7af99104903adbc26821f42cbe8b195c22"' :
                                        'id="xs-injectables-links-module-TokenModule-a2ce5dd79f6d41fd4ed1f0980edd7019a553d2a5b27e0e9c24a057d0f3338ccb2dcd06e836d33537f90029f3237e9e7af99104903adbc26821f42cbe8b195c22"' }>
                                        <li class="link">
                                            <a href="injectables/TokenService.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >TokenService</a>
                                        </li>
                                    </ul>
                                </li>
                            </li>
                            <li class="link">
                                <a href="modules/UsersModule.html" data-type="entity-link" >UsersModule</a>
                                    <li class="chapter inner">
                                        <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ?
                                            'data-bs-target="#controllers-links-module-UsersModule-e4225931a3d17c9b92c80180c18561aff0acf879f6deeda8fa84882074e6527222554e176c14c1073046dda8c66f16513a0b651260783a869fcd49be50d2297a"' : 'data-bs-target="#xs-controllers-links-module-UsersModule-e4225931a3d17c9b92c80180c18561aff0acf879f6deeda8fa84882074e6527222554e176c14c1073046dda8c66f16513a0b651260783a869fcd49be50d2297a"' }>
                                            <span class="icon ion-md-swap"></span>
                                            <span>Controllers</span>
                                            <span class="icon ion-ios-arrow-down"></span>
                                        </div>
                                        <ul class="links collapse" ${ isNormalMode ? 'id="controllers-links-module-UsersModule-e4225931a3d17c9b92c80180c18561aff0acf879f6deeda8fa84882074e6527222554e176c14c1073046dda8c66f16513a0b651260783a869fcd49be50d2297a"' :
                                            'id="xs-controllers-links-module-UsersModule-e4225931a3d17c9b92c80180c18561aff0acf879f6deeda8fa84882074e6527222554e176c14c1073046dda8c66f16513a0b651260783a869fcd49be50d2297a"' }>
                                            <li class="link">
                                                <a href="controllers/AdminUsersController.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >AdminUsersController</a>
                                            </li>
                                            <li class="link">
                                                <a href="controllers/UsersController.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >UsersController</a>
                                            </li>
                                        </ul>
                                    </li>
                                <li class="chapter inner">
                                    <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ?
                                        'data-bs-target="#injectables-links-module-UsersModule-e4225931a3d17c9b92c80180c18561aff0acf879f6deeda8fa84882074e6527222554e176c14c1073046dda8c66f16513a0b651260783a869fcd49be50d2297a"' : 'data-bs-target="#xs-injectables-links-module-UsersModule-e4225931a3d17c9b92c80180c18561aff0acf879f6deeda8fa84882074e6527222554e176c14c1073046dda8c66f16513a0b651260783a869fcd49be50d2297a"' }>
                                        <span class="icon ion-md-arrow-round-down"></span>
                                        <span>Injectables</span>
                                        <span class="icon ion-ios-arrow-down"></span>
                                    </div>
                                    <ul class="links collapse" ${ isNormalMode ? 'id="injectables-links-module-UsersModule-e4225931a3d17c9b92c80180c18561aff0acf879f6deeda8fa84882074e6527222554e176c14c1073046dda8c66f16513a0b651260783a869fcd49be50d2297a"' :
                                        'id="xs-injectables-links-module-UsersModule-e4225931a3d17c9b92c80180c18561aff0acf879f6deeda8fa84882074e6527222554e176c14c1073046dda8c66f16513a0b651260783a869fcd49be50d2297a"' }>
                                        <li class="link">
                                            <a href="injectables/UsersService.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >UsersService</a>
                                        </li>
                                    </ul>
                                </li>
                            </li>
                </ul>
                </li>
                        <li class="chapter">
                            <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ? 'data-bs-target="#entities-links"' :
                                'data-bs-target="#xs-entities-links"' }>
                                <span class="icon ion-ios-apps"></span>
                                <span>Entities</span>
                                <span class="icon ion-ios-arrow-down"></span>
                            </div>
                            <ul class="links collapse " ${ isNormalMode ? 'id="entities-links"' : 'id="xs-entities-links"' }>
                                <li class="link">
                                    <a href="entities/Session.html" data-type="entity-link" >Session</a>
                                </li>
                                <li class="link">
                                    <a href="entities/User.html" data-type="entity-link" >User</a>
                                </li>
                            </ul>
                        </li>
                    <li class="chapter">
                        <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ? 'data-bs-target="#classes-links"' :
                            'data-bs-target="#xs-classes-links"' }>
                            <span class="icon ion-ios-paper"></span>
                            <span>Classes</span>
                            <span class="icon ion-ios-arrow-down"></span>
                        </div>
                        <ul class="links collapse " ${ isNormalMode ? 'id="classes-links"' : 'id="xs-classes-links"' }>
                            <li class="link">
                                <a href="classes/AddRotatedAtFieldOnSessionEntity1781430797078.html" data-type="entity-link" >AddRotatedAtFieldOnSessionEntity1781430797078</a>
                            </li>
                            <li class="link">
                                <a href="classes/AddSessionFields1778584733796.html" data-type="entity-link" >AddSessionFields1778584733796</a>
                            </li>
                            <li class="link">
                                <a href="classes/AddVersionFieldToSessionEntity1782233299217.html" data-type="entity-link" >AddVersionFieldToSessionEntity1782233299217</a>
                            </li>
                            <li class="link">
                                <a href="classes/AdminUserResponseDto.html" data-type="entity-link" >AdminUserResponseDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/ApiClient.html" data-type="entity-link" >ApiClient</a>
                            </li>
                            <li class="link">
                                <a href="classes/AppError.html" data-type="entity-link" >AppError</a>
                            </li>
                            <li class="link">
                                <a href="classes/AuthErrors.html" data-type="entity-link" >AuthErrors</a>
                            </li>
                            <li class="link">
                                <a href="classes/AuthFactory.html" data-type="entity-link" >AuthFactory</a>
                            </li>
                            <li class="link">
                                <a href="classes/ChangePasswordDto.html" data-type="entity-link" >ChangePasswordDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/ChangePasswordRequestDto.html" data-type="entity-link" >ChangePasswordRequestDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/CreateUserAndSessionTable1767562475194.html" data-type="entity-link" >CreateUserAndSessionTable1767562475194</a>
                            </li>
                            <li class="link">
                                <a href="classes/CreateUserRequestDto.html" data-type="entity-link" >CreateUserRequestDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/ErrorMapper.html" data-type="entity-link" >ErrorMapper</a>
                            </li>
                            <li class="link">
                                <a href="classes/ErrorResponseDto.html" data-type="entity-link" >ErrorResponseDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/GlobalExceptionFilter.html" data-type="entity-link" >GlobalExceptionFilter</a>
                            </li>
                            <li class="link">
                                <a href="classes/IdDto.html" data-type="entity-link" >IdDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/LoginUserRequestDto.html" data-type="entity-link" >LoginUserRequestDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/LoginUserResponseDto.html" data-type="entity-link" >LoginUserResponseDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/RegisterUserRequestDto.html" data-type="entity-link" >RegisterUserRequestDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/RegistryDates.html" data-type="entity-link" >RegistryDates</a>
                            </li>
                            <li class="link">
                                <a href="classes/RegistryDatesDto.html" data-type="entity-link" >RegistryDatesDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/RegistryDatesOrm.html" data-type="entity-link" >RegistryDatesOrm</a>
                            </li>
                            <li class="link">
                                <a href="classes/RemoveDto.html" data-type="entity-link" >RemoveDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/RenameUserAgentToDevice1781203122645.html" data-type="entity-link" >RenameUserAgentToDevice1781203122645</a>
                            </li>
                            <li class="link">
                                <a href="classes/SecurityErrors.html" data-type="entity-link" >SecurityErrors</a>
                            </li>
                            <li class="link">
                                <a href="classes/SessionErrors.html" data-type="entity-link" >SessionErrors</a>
                            </li>
                            <li class="link">
                                <a href="classes/SessionResponseDto.html" data-type="entity-link" >SessionResponseDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/SessionsDto.html" data-type="entity-link" >SessionsDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/TimestampResponseDto.html" data-type="entity-link" >TimestampResponseDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/TokenErrors.html" data-type="entity-link" >TokenErrors</a>
                            </li>
                            <li class="link">
                                <a href="classes/UpdateUserRequestDto.html" data-type="entity-link" >UpdateUserRequestDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/User.html" data-type="entity-link" >User</a>
                            </li>
                            <li class="link">
                                <a href="classes/UserErrors.html" data-type="entity-link" >UserErrors</a>
                            </li>
                            <li class="link">
                                <a href="classes/UserFactory.html" data-type="entity-link" >UserFactory</a>
                            </li>
                            <li class="link">
                                <a href="classes/UserProfileResponseDto.html" data-type="entity-link" >UserProfileResponseDto</a>
                            </li>
                        </ul>
                    </li>
                        <li class="chapter">
                            <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ? 'data-bs-target="#injectables-links"' :
                                'data-bs-target="#xs-injectables-links"' }>
                                <span class="icon ion-md-arrow-round-down"></span>
                                <span>Injectables</span>
                                <span class="icon ion-ios-arrow-down"></span>
                            </div>
                            <ul class="links collapse " ${ isNormalMode ? 'id="injectables-links"' : 'id="xs-injectables-links"' }>
                                <li class="link">
                                    <a href="injectables/AuthCookieInterceptor.html" data-type="entity-link" >AuthCookieInterceptor</a>
                                </li>
                                <li class="link">
                                    <a href="injectables/DeviceMiddleware.html" data-type="entity-link" >DeviceMiddleware</a>
                                </li>
                                <li class="link">
                                    <a href="injectables/HashingProvider.html" data-type="entity-link" >HashingProvider</a>
                                </li>
                                <li class="link">
                                    <a href="injectables/SerializeInterceptor.html" data-type="entity-link" >SerializeInterceptor</a>
                                </li>
                            </ul>
                        </li>
                    <li class="chapter">
                        <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ? 'data-bs-target="#guards-links"' :
                            'data-bs-target="#xs-guards-links"' }>
                            <span class="icon ion-ios-lock"></span>
                            <span>Guards</span>
                            <span class="icon ion-ios-arrow-down"></span>
                        </div>
                        <ul class="links collapse " ${ isNormalMode ? 'id="guards-links"' : 'id="xs-guards-links"' }>
                            <li class="link">
                                <a href="guards/JwtGuard.html" data-type="entity-link" >JwtGuard</a>
                            </li>
                            <li class="link">
                                <a href="guards/RolesGuard.html" data-type="entity-link" >RolesGuard</a>
                            </li>
                        </ul>
                    </li>
                    <li class="chapter">
                        <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ? 'data-bs-target="#interfaces-links"' :
                            'data-bs-target="#xs-interfaces-links"' }>
                            <span class="icon ion-md-information-circle-outline"></span>
                            <span>Interfaces</span>
                            <span class="icon ion-ios-arrow-down"></span>
                        </div>
                        <ul class="links collapse " ${ isNormalMode ? ' id="interfaces-links"' : 'id="xs-interfaces-links"' }>
                            <li class="link">
                                <a href="interfaces/CustomAuth.html" data-type="entity-link" >CustomAuth</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/DeviceContext.html" data-type="entity-link" >DeviceContext</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/IAuthService.html" data-type="entity-link" >IAuthService</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/IDeviceFingerprintInput.html" data-type="entity-link" >IDeviceFingerprintInput</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/IJwtClaims.html" data-type="entity-link" >IJwtClaims</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/IJwtConfig.html" data-type="entity-link" >IJwtConfig</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/IJwtPayload.html" data-type="entity-link" >IJwtPayload</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/IRequest.html" data-type="entity-link" >IRequest</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/ISessionDevice.html" data-type="entity-link" >ISessionDevice</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/ISessionsService.html" data-type="entity-link" >ISessionsService</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/ITextContext.html" data-type="entity-link" >ITextContext</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/ITokenService.html" data-type="entity-link" >ITokenService</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/IUserAgent.html" data-type="entity-link" >IUserAgent</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/IUsersService.html" data-type="entity-link" >IUsersService</a>
                            </li>
                        </ul>
                    </li>
                    <li class="chapter">
                        <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ? 'data-bs-target="#miscellaneous-links"'
                            : 'data-bs-target="#xs-miscellaneous-links"' }>
                            <span class="icon ion-ios-cube"></span>
                            <span>Miscellaneous</span>
                            <span class="icon ion-ios-arrow-down"></span>
                        </div>
                        <ul class="links collapse " ${ isNormalMode ? 'id="miscellaneous-links"' : 'id="xs-miscellaneous-links"' }>
                            <li class="link">
                                <a href="miscellaneous/enumerations.html" data-type="entity-link">Enums</a>
                            </li>
                            <li class="link">
                                <a href="miscellaneous/functions.html" data-type="entity-link">Functions</a>
                            </li>
                            <li class="link">
                                <a href="miscellaneous/typealiases.html" data-type="entity-link">Type aliases</a>
                            </li>
                            <li class="link">
                                <a href="miscellaneous/variables.html" data-type="entity-link">Variables</a>
                            </li>
                        </ul>
                    </li>
                        <li class="chapter">
                            <a data-type="chapter-link" href="routes.html"><span class="icon ion-ios-git-branch"></span>Routes</a>
                        </li>
                    <li class="chapter">
                        <a data-type="chapter-link" href="coverage.html"><span class="icon ion-ios-stats"></span>Documentation coverage</a>
                    </li>
                    <li class="divider"></li>
                    <li class="copyright">
                        Documentation generated using <a href="https://compodoc.app/" target="_blank" rel="noopener noreferrer">
                            <img data-src="images/compodoc-vectorise.png" class="img-responsive" data-type="compodoc-logo">
                        </a>
                    </li>
            </ul>
        </nav>
        `);
        this.innerHTML = tp.strings;
    }
});