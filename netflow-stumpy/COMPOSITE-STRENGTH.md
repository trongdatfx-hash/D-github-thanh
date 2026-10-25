# Composite Strength D common

Version: dcommon-taker-70-30-v1.

All analyze(composite(SPY,QQQ),step) paths now use the same impulse as D common: 0.7*tanh(netSPY/SMA20(quoteSPY))+0.3*tanh(netQQQ/SMA20(quoteQQQ)). SMA uses the available prefix until twenty bars, exactly as the existing D common. Sum 8 impulses, EWMA half-life 2, 500-history magnitude-to-normal-CDF scaling, then the existing causal session adjustment. Gap handling is shared with D common. Native SPY/QQQ Strength and original-volume SPY V retain their formulas.

Composite q/buy/sell/net/nf remain additive raw quote-flow measures. Only its Strength changes. Chart, studies worker, geometry, WLR phase, pivot states, trend age, analog features and research producers all use the central engine. The optional dotted D common line is disabled by default because it duplicates Composite Strength.

Offline reports carry strengthVersion and are rejected until rebuilt. Historical old-policy reports cannot be used with the new features. The previous frozen V3 policy file is preserved; the new formula has its own v3-policy-lock-dcommon-v1.json. No historical edge or forward record transfers between formulas. New V3 retains its original gate checks and start date; it is a separate experimental cohort.
