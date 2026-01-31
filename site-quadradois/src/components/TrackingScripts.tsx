/**
 * TrackingScripts Component
 * Injeta scripts de tracking (GA4, GTM, Pixels) dinamicamente
 */

interface TrackingScriptsProps {
    googleAnalyticsId?: string | null;
    googleTagManagerId?: string | null;
    facebookPixelId?: string | null;
    tiktokPixelId?: string | null;
    linkedinInsightTag?: string | null;
    microsoftClarityId?: string | null;
    hotjarId?: string | null;
    googleSiteVerification?: string | null;
    bingVerification?: string | null;
    facebookDomainVerification?: string | null;
    allowIndexing?: boolean;
}

export default function TrackingScripts({
    googleAnalyticsId,
    googleTagManagerId,
    facebookPixelId,
    tiktokPixelId,
    linkedinInsightTag,
    microsoftClarityId,
    hotjarId,
    googleSiteVerification,
    bingVerification,
    facebookDomainVerification,
    allowIndexing = true,
}: TrackingScriptsProps) {
    return (
        <>
            {/* Meta Verifications */}
            {googleSiteVerification && (
                <meta name="google-site-verification" content={googleSiteVerification} />
            )}
            {bingVerification && (
                <meta name="msvalidate.01" content={bingVerification} />
            )}
            {facebookDomainVerification && (
                <meta name="facebook-domain-verification" content={facebookDomainVerification} />
            )}

            {/* Robots */}
            {!allowIndexing && (
                <meta name="robots" content="noindex, nofollow" />
            )}

            {/* Google Tag Manager - Head */}
            {googleTagManagerId && (
                <script
                    dangerouslySetInnerHTML={{
                        __html: `
                            (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
                            new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
                            j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
                            'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
                            })(window,document,'script','dataLayer','${googleTagManagerId}');
                        `,
                    }}
                />
            )}

            {/* Google Analytics 4 */}
            {googleAnalyticsId && !googleTagManagerId && (
                <>
                    <script
                        async
                        src={`https://www.googletagmanager.com/gtag/js?id=${googleAnalyticsId}`}
                    />
                    <script
                        dangerouslySetInnerHTML={{
                            __html: `
                                window.dataLayer = window.dataLayer || [];
                                function gtag(){dataLayer.push(arguments);}
                                gtag('js', new Date());
                                gtag('config', '${googleAnalyticsId}');
                            `,
                        }}
                    />
                </>
            )}

            {/* Facebook Pixel */}
            {facebookPixelId && (
                <script
                    dangerouslySetInnerHTML={{
                        __html: `
                            !function(f,b,e,v,n,t,s)
                            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
                            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
                            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
                            n.queue=[];t=b.createElement(e);t.async=!0;
                            t.src=v;s=b.getElementsByTagName(e)[0];
                            s.parentNode.insertBefore(t,s)}(window, document,'script',
                            'https://connect.facebook.net/en_US/fbevents.js');
                            fbq('init', '${facebookPixelId}');
                            fbq('track', 'PageView');
                        `,
                    }}
                />
            )}

            {/* TikTok Pixel */}
            {tiktokPixelId && (
                <script
                    dangerouslySetInnerHTML={{
                        __html: `
                            !function (w, d, t) {
                                w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=i,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};var o=document.createElement("script");o.type="text/javascript",o.async=!0,o.src=i+"?sdkid="+e+"&lib="+t;var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};
                                ttq.load('${tiktokPixelId}');
                                ttq.page();
                            }(window, document, 'ttq');
                        `,
                    }}
                />
            )}

            {/* LinkedIn Insight Tag */}
            {linkedinInsightTag && (
                <script
                    dangerouslySetInnerHTML={{
                        __html: `
                            _linkedin_partner_id = "${linkedinInsightTag}";
                            window._linkedin_data_partner_ids = window._linkedin_data_partner_ids || [];
                            window._linkedin_data_partner_ids.push(_linkedin_partner_id);
                            (function(l) {
                                if (!l){window.lintrk = function(a,b){window.lintrk.q.push([a,b])};
                                window.lintrk.q=[]}
                                var s = document.getElementsByTagName("script")[0];
                                var b = document.createElement("script");
                                b.type = "text/javascript";b.async = true;
                                b.src = "https://snap.licdn.com/li.lms-analytics/insight.min.js";
                                s.parentNode.insertBefore(b, s);})(window.lintrk);
                        `,
                    }}
                />
            )}

            {/* Microsoft Clarity */}
            {microsoftClarityId && (
                <script
                    dangerouslySetInnerHTML={{
                        __html: `
                            (function(c,l,a,r,i,t,y){
                                c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
                                t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
                                y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
                            })(window, document, "clarity", "script", "${microsoftClarityId}");
                        `,
                    }}
                />
            )}

            {/* Hotjar */}
            {hotjarId && (
                <script
                    dangerouslySetInnerHTML={{
                        __html: `
                            (function(h,o,t,j,a,r){
                                h.hj=h.hj||function(){(h.hj.q=h.hj.q||[]).push(arguments)};
                                h._hjSettings={hjid:${hotjarId},hjsv:6};
                                a=o.getElementsByTagName('head')[0];
                                r=o.createElement('script');r.async=1;
                                r.src=t+h._hjSettings.hjid+j+h._hjSettings.hjsv;
                                a.appendChild(r);
                            })(window,document,'https://static.hotjar.com/c/hotjar-','.js?sv=');
                        `,
                    }}
                />
            )}
        </>
    );
}

// GTM NoScript (para body)
export function GTMNoScript({ googleTagManagerId }: { googleTagManagerId?: string | null }) {
    if (!googleTagManagerId) return null;

    return (
        <noscript
            dangerouslySetInnerHTML={{
                __html: `<iframe src="https://www.googletagmanager.com/ns.html?id=${googleTagManagerId}" height="0" width="0" style="display:none;visibility:hidden"></iframe>`,
            }}
        />
    );
}
