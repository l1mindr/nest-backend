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
                ${ isNormalMode ? `<div id="book-search-input" role="search">
    <input type="text" placeholder="Type to search">
    <button type="button"
        class="search-input-clear"
        aria-label="Clear search"
        data-search-input-clear>&times;</button>
</div>
` : '' }
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
                                    <a href="architecture.html" data-type="chapter-link">
                                        <span class="icon ion-ios-git-branch"></span>Architecture
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
                                            'data-bs-target="#controllers-links-module-AuthModule-9b23e789e889e565ae36623daf2618b345e9ebaf440a7a0dc5866db1e556b53eb584c995715a2793c12c4633b5cd6941cfbce18c3a06866ae696d474076ee7a1"' : 'data-bs-target="#xs-controllers-links-module-AuthModule-9b23e789e889e565ae36623daf2618b345e9ebaf440a7a0dc5866db1e556b53eb584c995715a2793c12c4633b5cd6941cfbce18c3a06866ae696d474076ee7a1"' }>
                                            <span class="icon ion-md-swap"></span>
                                            <span>Controllers</span>
                                            <span class="icon ion-ios-arrow-down"></span>
                                        </div>
                                        <ul class="links collapse" ${ isNormalMode ? 'id="controllers-links-module-AuthModule-9b23e789e889e565ae36623daf2618b345e9ebaf440a7a0dc5866db1e556b53eb584c995715a2793c12c4633b5cd6941cfbce18c3a06866ae696d474076ee7a1"' :
                                            'id="xs-controllers-links-module-AuthModule-9b23e789e889e565ae36623daf2618b345e9ebaf440a7a0dc5866db1e556b53eb584c995715a2793c12c4633b5cd6941cfbce18c3a06866ae696d474076ee7a1"' }>
                                            <li class="link">
                                                <a href="controllers/AuthController.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >AuthController</a>
                                            </li>
                                        </ul>
                                    </li>
                                <li class="chapter inner">
                                    <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ?
                                        'data-bs-target="#injectables-links-module-AuthModule-9b23e789e889e565ae36623daf2618b345e9ebaf440a7a0dc5866db1e556b53eb584c995715a2793c12c4633b5cd6941cfbce18c3a06866ae696d474076ee7a1"' : 'data-bs-target="#xs-injectables-links-module-AuthModule-9b23e789e889e565ae36623daf2618b345e9ebaf440a7a0dc5866db1e556b53eb584c995715a2793c12c4633b5cd6941cfbce18c3a06866ae696d474076ee7a1"' }>
                                        <span class="icon ion-md-arrow-round-down"></span>
                                        <span>Injectables</span>
                                        <span class="icon ion-ios-arrow-down"></span>
                                    </div>
                                    <ul class="links collapse" ${ isNormalMode ? 'id="injectables-links-module-AuthModule-9b23e789e889e565ae36623daf2618b345e9ebaf440a7a0dc5866db1e556b53eb584c995715a2793c12c4633b5cd6941cfbce18c3a06866ae696d474076ee7a1"' :
                                        'id="xs-injectables-links-module-AuthModule-9b23e789e889e565ae36623daf2618b345e9ebaf440a7a0dc5866db1e556b53eb584c995715a2793c12c4633b5cd6941cfbce18c3a06866ae696d474076ee7a1"' }>
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
                                <a href="modules/CoreModule.html" data-type="entity-link" >CoreModule</a>
                            </li>
                            <li class="link">
                                <a href="modules/CsrfModule.html" data-type="entity-link" >CsrfModule</a>
                                <li class="chapter inner">
                                    <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ?
                                        'data-bs-target="#injectables-links-module-CsrfModule-76c97ea4cde38a7e38e6cd05254b9d3fc19d36e0db81369921d4c776aa3ea64c0196b2c0380f40047e380ea1817a757c9cb6eb7e3ed585b3f37ce60415e63d95"' : 'data-bs-target="#xs-injectables-links-module-CsrfModule-76c97ea4cde38a7e38e6cd05254b9d3fc19d36e0db81369921d4c776aa3ea64c0196b2c0380f40047e380ea1817a757c9cb6eb7e3ed585b3f37ce60415e63d95"' }>
                                        <span class="icon ion-md-arrow-round-down"></span>
                                        <span>Injectables</span>
                                        <span class="icon ion-ios-arrow-down"></span>
                                    </div>
                                    <ul class="links collapse" ${ isNormalMode ? 'id="injectables-links-module-CsrfModule-76c97ea4cde38a7e38e6cd05254b9d3fc19d36e0db81369921d4c776aa3ea64c0196b2c0380f40047e380ea1817a757c9cb6eb7e3ed585b3f37ce60415e63d95"' :
                                        'id="xs-injectables-links-module-CsrfModule-76c97ea4cde38a7e38e6cd05254b9d3fc19d36e0db81369921d4c776aa3ea64c0196b2c0380f40047e380ea1817a757c9cb6eb7e3ed585b3f37ce60415e63d95"' }>
                                        <li class="link">
                                            <a href="injectables/CsrfService.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >CsrfService</a>
                                        </li>
                                    </ul>
                                </li>
                            </li>
                            <li class="link">
                                <a href="modules/DatabasesModule.html" data-type="entity-link" >DatabasesModule</a>
                            </li>
                            <li class="link">
                                <a href="modules/DeviceDetectionModule.html" data-type="entity-link" >DeviceDetectionModule</a>
                                <li class="chapter inner">
                                    <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ?
                                        'data-bs-target="#injectables-links-module-DeviceDetectionModule-fe4026f846fff525d4a01ed9aeebb24f400d4e0f12b07b082505fe81aff7f1e88a7daca99e4c32ab124171dca0c3ddefe1d927619337cc6dd1c8ef20fce86965"' : 'data-bs-target="#xs-injectables-links-module-DeviceDetectionModule-fe4026f846fff525d4a01ed9aeebb24f400d4e0f12b07b082505fe81aff7f1e88a7daca99e4c32ab124171dca0c3ddefe1d927619337cc6dd1c8ef20fce86965"' }>
                                        <span class="icon ion-md-arrow-round-down"></span>
                                        <span>Injectables</span>
                                        <span class="icon ion-ios-arrow-down"></span>
                                    </div>
                                    <ul class="links collapse" ${ isNormalMode ? 'id="injectables-links-module-DeviceDetectionModule-fe4026f846fff525d4a01ed9aeebb24f400d4e0f12b07b082505fe81aff7f1e88a7daca99e4c32ab124171dca0c3ddefe1d927619337cc6dd1c8ef20fce86965"' :
                                        'id="xs-injectables-links-module-DeviceDetectionModule-fe4026f846fff525d4a01ed9aeebb24f400d4e0f12b07b082505fe81aff7f1e88a7daca99e4c32ab124171dca0c3ddefe1d927619337cc6dd1c8ef20fce86965"' }>
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
                                <li class="chapter inner">
                                    <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ?
                                        'data-bs-target="#injectables-links-module-InfrastructureModule-761a5167c8d614beeb3337ab8a954b8a2b5e49c086a09877e0be32b8f23d9038bb6cc9c6fc81d6c7c88caf3dd7fbdc421e0a5ba135c51dea9d674ee7e6d457a8"' : 'data-bs-target="#xs-injectables-links-module-InfrastructureModule-761a5167c8d614beeb3337ab8a954b8a2b5e49c086a09877e0be32b8f23d9038bb6cc9c6fc81d6c7c88caf3dd7fbdc421e0a5ba135c51dea9d674ee7e6d457a8"' }>
                                        <span class="icon ion-md-arrow-round-down"></span>
                                        <span>Injectables</span>
                                        <span class="icon ion-ios-arrow-down"></span>
                                    </div>
                                    <ul class="links collapse" ${ isNormalMode ? 'id="injectables-links-module-InfrastructureModule-761a5167c8d614beeb3337ab8a954b8a2b5e49c086a09877e0be32b8f23d9038bb6cc9c6fc81d6c7c88caf3dd7fbdc421e0a5ba135c51dea9d674ee7e6d457a8"' :
                                        'id="xs-injectables-links-module-InfrastructureModule-761a5167c8d614beeb3337ab8a954b8a2b5e49c086a09877e0be32b8f23d9038bb6cc9c6fc81d6c7c88caf3dd7fbdc421e0a5ba135c51dea9d674ee7e6d457a8"' }>
                                        <li class="link">
                                            <a href="injectables/DataResponseInterceptor.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >DataResponseInterceptor</a>
                                        </li>
                                    </ul>
                                </li>
                            </li>
                            <li class="link">
                                <a href="modules/PostgresModule.html" data-type="entity-link" >PostgresModule</a>
                            </li>
                            <li class="link">
                                <a href="modules/RateLimitModule.html" data-type="entity-link" >RateLimitModule</a>
                                <li class="chapter inner">
                                    <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ?
                                        'data-bs-target="#injectables-links-module-RateLimitModule-4f7c050a73f0dc22d42e0008c6a32c74d763fca6eb49016fbe01da47966d573a3bb925097c590d7f9b0899fe3e86b64230fae447798a53bb994ff8dfa1259d53"' : 'data-bs-target="#xs-injectables-links-module-RateLimitModule-4f7c050a73f0dc22d42e0008c6a32c74d763fca6eb49016fbe01da47966d573a3bb925097c590d7f9b0899fe3e86b64230fae447798a53bb994ff8dfa1259d53"' }>
                                        <span class="icon ion-md-arrow-round-down"></span>
                                        <span>Injectables</span>
                                        <span class="icon ion-ios-arrow-down"></span>
                                    </div>
                                    <ul class="links collapse" ${ isNormalMode ? 'id="injectables-links-module-RateLimitModule-4f7c050a73f0dc22d42e0008c6a32c74d763fca6eb49016fbe01da47966d573a3bb925097c590d7f9b0899fe3e86b64230fae447798a53bb994ff8dfa1259d53"' :
                                        'id="xs-injectables-links-module-RateLimitModule-4f7c050a73f0dc22d42e0008c6a32c74d763fca6eb49016fbe01da47966d573a3bb925097c590d7f9b0899fe3e86b64230fae447798a53bb994ff8dfa1259d53"' }>
                                        <li class="link">
                                            <a href="injectables/RateLimitService.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >RateLimitService</a>
                                        </li>
                                    </ul>
                                </li>
                            </li>
                            <li class="link">
                                <a href="modules/RedisModule.html" data-type="entity-link" >RedisModule</a>
                                <li class="chapter inner">
                                    <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ?
                                        'data-bs-target="#injectables-links-module-RedisModule-d34b7f5bb45aaad2f6211c3e6895af924ce0c2a9046f4124634f33dbfebfe46b74ecbcaa97f3a541d96ddde55bb0184b941f97293e208a27ef7a67202dba9705"' : 'data-bs-target="#xs-injectables-links-module-RedisModule-d34b7f5bb45aaad2f6211c3e6895af924ce0c2a9046f4124634f33dbfebfe46b74ecbcaa97f3a541d96ddde55bb0184b941f97293e208a27ef7a67202dba9705"' }>
                                        <span class="icon ion-md-arrow-round-down"></span>
                                        <span>Injectables</span>
                                        <span class="icon ion-ios-arrow-down"></span>
                                    </div>
                                    <ul class="links collapse" ${ isNormalMode ? 'id="injectables-links-module-RedisModule-d34b7f5bb45aaad2f6211c3e6895af924ce0c2a9046f4124634f33dbfebfe46b74ecbcaa97f3a541d96ddde55bb0184b941f97293e208a27ef7a67202dba9705"' :
                                        'id="xs-injectables-links-module-RedisModule-d34b7f5bb45aaad2f6211c3e6895af924ce0c2a9046f4124634f33dbfebfe46b74ecbcaa97f3a541d96ddde55bb0184b941f97293e208a27ef7a67202dba9705"' }>
                                        <li class="link">
                                            <a href="injectables/RedisCounterService.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >RedisCounterService</a>
                                        </li>
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
                                        'data-bs-target="#injectables-links-module-SecurityModule-61a31276f1ca021d65eae4743fcd5a364295dc9d7bd7da2181da9c9cc645a6574b2cb0a1269f8547dbc534b87d23347eac9ee3f5b1794f7cc82b2fb1a26312c3"' : 'data-bs-target="#xs-injectables-links-module-SecurityModule-61a31276f1ca021d65eae4743fcd5a364295dc9d7bd7da2181da9c9cc645a6574b2cb0a1269f8547dbc534b87d23347eac9ee3f5b1794f7cc82b2fb1a26312c3"' }>
                                        <span class="icon ion-md-arrow-round-down"></span>
                                        <span>Injectables</span>
                                        <span class="icon ion-ios-arrow-down"></span>
                                    </div>
                                    <ul class="links collapse" ${ isNormalMode ? 'id="injectables-links-module-SecurityModule-61a31276f1ca021d65eae4743fcd5a364295dc9d7bd7da2181da9c9cc645a6574b2cb0a1269f8547dbc534b87d23347eac9ee3f5b1794f7cc82b2fb1a26312c3"' :
                                        'id="xs-injectables-links-module-SecurityModule-61a31276f1ca021d65eae4743fcd5a364295dc9d7bd7da2181da9c9cc645a6574b2cb0a1269f8547dbc534b87d23347eac9ee3f5b1794f7cc82b2fb1a26312c3"' }>
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
                                        'data-bs-target="#injectables-links-module-TokenModule-b00830e2c919c99277a8b7ecfe5c45b4ff453044996d4688ff1b46990772f0fef2901a6b472897704304f2179d75c1ae8a234e04eaf33ca7d7bd88a4acc24902"' : 'data-bs-target="#xs-injectables-links-module-TokenModule-b00830e2c919c99277a8b7ecfe5c45b4ff453044996d4688ff1b46990772f0fef2901a6b472897704304f2179d75c1ae8a234e04eaf33ca7d7bd88a4acc24902"' }>
                                        <span class="icon ion-md-arrow-round-down"></span>
                                        <span>Injectables</span>
                                        <span class="icon ion-ios-arrow-down"></span>
                                    </div>
                                    <ul class="links collapse" ${ isNormalMode ? 'id="injectables-links-module-TokenModule-b00830e2c919c99277a8b7ecfe5c45b4ff453044996d4688ff1b46990772f0fef2901a6b472897704304f2179d75c1ae8a234e04eaf33ca7d7bd88a4acc24902"' :
                                        'id="xs-injectables-links-module-TokenModule-b00830e2c919c99277a8b7ecfe5c45b4ff453044996d4688ff1b46990772f0fef2901a6b472897704304f2179d75c1ae8a234e04eaf33ca7d7bd88a4acc24902"' }>
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
                                <a href="guards/CsrfGuard.html" data-type="entity-link" >CsrfGuard</a>
                            </li>
                            <li class="link">
                                <a href="guards/JwtGuard.html" data-type="entity-link" >JwtGuard</a>
                            </li>
                            <li class="link">
                                <a href="guards/RateLimitGuard.html" data-type="entity-link" >RateLimitGuard</a>
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
                            <li class="link">
                                <a href="interfaces/RateLimitOptions.html" data-type="entity-link" >RateLimitOptions</a>
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
