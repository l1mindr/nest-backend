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
                                            'data-bs-target="#controllers-links-module-AuthModule-cec8259b9b76483f3fbb1ebf0b145f9d03cdbda6cb200eb2d8344b037454b40e94c20a635dbd5f081904b04842ec72d0b943a5c32161b18aa5d9849e19119770"' : 'data-bs-target="#xs-controllers-links-module-AuthModule-cec8259b9b76483f3fbb1ebf0b145f9d03cdbda6cb200eb2d8344b037454b40e94c20a635dbd5f081904b04842ec72d0b943a5c32161b18aa5d9849e19119770"' }>
                                            <span class="icon ion-md-swap"></span>
                                            <span>Controllers</span>
                                            <span class="icon ion-ios-arrow-down"></span>
                                        </div>
                                        <ul class="links collapse" ${ isNormalMode ? 'id="controllers-links-module-AuthModule-cec8259b9b76483f3fbb1ebf0b145f9d03cdbda6cb200eb2d8344b037454b40e94c20a635dbd5f081904b04842ec72d0b943a5c32161b18aa5d9849e19119770"' :
                                            'id="xs-controllers-links-module-AuthModule-cec8259b9b76483f3fbb1ebf0b145f9d03cdbda6cb200eb2d8344b037454b40e94c20a635dbd5f081904b04842ec72d0b943a5c32161b18aa5d9849e19119770"' }>
                                            <li class="link">
                                                <a href="controllers/AuthController.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >AuthController</a>
                                            </li>
                                        </ul>
                                    </li>
                                <li class="chapter inner">
                                    <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ?
                                        'data-bs-target="#injectables-links-module-AuthModule-cec8259b9b76483f3fbb1ebf0b145f9d03cdbda6cb200eb2d8344b037454b40e94c20a635dbd5f081904b04842ec72d0b943a5c32161b18aa5d9849e19119770"' : 'data-bs-target="#xs-injectables-links-module-AuthModule-cec8259b9b76483f3fbb1ebf0b145f9d03cdbda6cb200eb2d8344b037454b40e94c20a635dbd5f081904b04842ec72d0b943a5c32161b18aa5d9849e19119770"' }>
                                        <span class="icon ion-md-arrow-round-down"></span>
                                        <span>Injectables</span>
                                        <span class="icon ion-ios-arrow-down"></span>
                                    </div>
                                    <ul class="links collapse" ${ isNormalMode ? 'id="injectables-links-module-AuthModule-cec8259b9b76483f3fbb1ebf0b145f9d03cdbda6cb200eb2d8344b037454b40e94c20a635dbd5f081904b04842ec72d0b943a5c32161b18aa5d9849e19119770"' :
                                        'id="xs-injectables-links-module-AuthModule-cec8259b9b76483f3fbb1ebf0b145f9d03cdbda6cb200eb2d8344b037454b40e94c20a635dbd5f081904b04842ec72d0b943a5c32161b18aa5d9849e19119770"' }>
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
                                <a href="modules/CommonModule.html" data-type="entity-link" >CommonModule</a>
                                <li class="chapter inner">
                                    <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ?
                                        'data-bs-target="#injectables-links-module-CommonModule-2f7175874f784bb669ec8c58ef256681187d59c294742f5f73d63981178f8cb13e1ed3a961b6f8b34685c51e270cdfb08d7a9c3c3f156ef46a90a501b9b79f4c"' : 'data-bs-target="#xs-injectables-links-module-CommonModule-2f7175874f784bb669ec8c58ef256681187d59c294742f5f73d63981178f8cb13e1ed3a961b6f8b34685c51e270cdfb08d7a9c3c3f156ef46a90a501b9b79f4c"' }>
                                        <span class="icon ion-md-arrow-round-down"></span>
                                        <span>Injectables</span>
                                        <span class="icon ion-ios-arrow-down"></span>
                                    </div>
                                    <ul class="links collapse" ${ isNormalMode ? 'id="injectables-links-module-CommonModule-2f7175874f784bb669ec8c58ef256681187d59c294742f5f73d63981178f8cb13e1ed3a961b6f8b34685c51e270cdfb08d7a9c3c3f156ef46a90a501b9b79f4c"' :
                                        'id="xs-injectables-links-module-CommonModule-2f7175874f784bb669ec8c58ef256681187d59c294742f5f73d63981178f8cb13e1ed3a961b6f8b34685c51e270cdfb08d7a9c3c3f156ef46a90a501b9b79f4c"' }>
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
                                <a href="modules/DatabaseModule.html" data-type="entity-link" >DatabaseModule</a>
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
                                <a href="modules/SecurityModule.html" data-type="entity-link" >SecurityModule</a>
                                <li class="chapter inner">
                                    <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ?
                                        'data-bs-target="#injectables-links-module-SecurityModule-a579d508c47856e88c351bc8aadd040dfbbfa50255adc39cf12219f1a0d6e5bbd3890a9b651781d8bf1c44b6a5c07ad7972f63e3a8b2c0fd4714a065b89f4a9e"' : 'data-bs-target="#xs-injectables-links-module-SecurityModule-a579d508c47856e88c351bc8aadd040dfbbfa50255adc39cf12219f1a0d6e5bbd3890a9b651781d8bf1c44b6a5c07ad7972f63e3a8b2c0fd4714a065b89f4a9e"' }>
                                        <span class="icon ion-md-arrow-round-down"></span>
                                        <span>Injectables</span>
                                        <span class="icon ion-ios-arrow-down"></span>
                                    </div>
                                    <ul class="links collapse" ${ isNormalMode ? 'id="injectables-links-module-SecurityModule-a579d508c47856e88c351bc8aadd040dfbbfa50255adc39cf12219f1a0d6e5bbd3890a9b651781d8bf1c44b6a5c07ad7972f63e3a8b2c0fd4714a065b89f4a9e"' :
                                        'id="xs-injectables-links-module-SecurityModule-a579d508c47856e88c351bc8aadd040dfbbfa50255adc39cf12219f1a0d6e5bbd3890a9b651781d8bf1c44b6a5c07ad7972f63e3a8b2c0fd4714a065b89f4a9e"' }>
                                        <li class="link">
                                            <a href="injectables/JwtAuthGuard.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >JwtAuthGuard</a>
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
                                        'data-bs-target="#injectables-links-module-TokenModule-9e3ea125a46affcda788ca5cd0547d6ad94af7510823d5e9a14e5264a87648d44bc01124c7bc05f9f094cfbe85542b1a45b23a03195191338372902490b35697"' : 'data-bs-target="#xs-injectables-links-module-TokenModule-9e3ea125a46affcda788ca5cd0547d6ad94af7510823d5e9a14e5264a87648d44bc01124c7bc05f9f094cfbe85542b1a45b23a03195191338372902490b35697"' }>
                                        <span class="icon ion-md-arrow-round-down"></span>
                                        <span>Injectables</span>
                                        <span class="icon ion-ios-arrow-down"></span>
                                    </div>
                                    <ul class="links collapse" ${ isNormalMode ? 'id="injectables-links-module-TokenModule-9e3ea125a46affcda788ca5cd0547d6ad94af7510823d5e9a14e5264a87648d44bc01124c7bc05f9f094cfbe85542b1a45b23a03195191338372902490b35697"' :
                                        'id="xs-injectables-links-module-TokenModule-9e3ea125a46affcda788ca5cd0547d6ad94af7510823d5e9a14e5264a87648d44bc01124c7bc05f9f094cfbe85542b1a45b23a03195191338372902490b35697"' }>
                                        <li class="link">
                                            <a href="injectables/JwtStrategy.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >JwtStrategy</a>
                                        </li>
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
                                <a href="classes/AddSessionFields1778584733796.html" data-type="entity-link" >AddSessionFields1778584733796</a>
                            </li>
                            <li class="link">
                                <a href="classes/AdminUserDto.html" data-type="entity-link" >AdminUserDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/ApiClient.html" data-type="entity-link" >ApiClient</a>
                            </li>
                            <li class="link">
                                <a href="classes/ChangePasswordDto.html" data-type="entity-link" >ChangePasswordDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/CreateUserAndSessionTable1767562475194.html" data-type="entity-link" >CreateUserAndSessionTable1767562475194</a>
                            </li>
                            <li class="link">
                                <a href="classes/CreateUserDto.html" data-type="entity-link" >CreateUserDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/ErrorResponseDto.html" data-type="entity-link" >ErrorResponseDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/HttpExceptionFilter.html" data-type="entity-link" >HttpExceptionFilter</a>
                            </li>
                            <li class="link">
                                <a href="classes/IdDto.html" data-type="entity-link" >IdDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/LoginResponseDto.html" data-type="entity-link" >LoginResponseDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/LoginUserDto.html" data-type="entity-link" >LoginUserDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/RegisterUserDto.html" data-type="entity-link" >RegisterUserDto</a>
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
                                <a href="classes/SessionsDto.html" data-type="entity-link" >SessionsDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/UpdateUserDto.html" data-type="entity-link" >UpdateUserDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/User.html" data-type="entity-link" >User</a>
                            </li>
                            <li class="link">
                                <a href="classes/UserFactory.html" data-type="entity-link" >UserFactory</a>
                            </li>
                            <li class="link">
                                <a href="classes/UserProfileDto.html" data-type="entity-link" >UserProfileDto</a>
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
                                    <a href="injectables/HashingProvider.html" data-type="entity-link" >HashingProvider</a>
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
                                <a href="interfaces/CustomRequest.html" data-type="entity-link" >CustomRequest</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/IAuthService.html" data-type="entity-link" >IAuthService</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/IJwtPayload.html" data-type="entity-link" >IJwtPayload</a>
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