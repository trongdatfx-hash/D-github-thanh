# WLR displayed thickness: slope and flow

Uses strictly prior closed price candles. Fit linearly weighted WLR13, normalize absolute slope by ATR14: abs(slope)*13/ATR14. Trend quality = tanh(normalizedSlope)*R². Flow quality = sqrt(tanh(abs(SPY V))*tanh(abs(Composite))), only when both sources exceed +/-0.07 and agree with price slope. Missing flow contributes zero.

Quality = (0.61*trendQuality + 0.39*flowQuality) / (1+(sigma13/ATR14)^2). Sigma13 is the weighted residual standard deviation around the same short price fit. It is a noise penalty rather than the primary driver. Constant price is not a trend, even when flow is strong.

Displayed width is 2+8*quality, smoothed recursively with alpha 0.35. Gaps reset the state and require 14 prior closed bars. Live values never enter their own width. Prices, color hysteresis, candles, historical model features and frozen policies retain their existing definitions. Weights are design choices, not calibrated predictive confidence.
