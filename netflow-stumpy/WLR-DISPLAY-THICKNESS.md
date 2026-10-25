# Display thickness: sigma × SPY V × Composite

WLR sigma is the existing weighted residual standard deviation around the prior-50-close WLR. For each displayed bar, Pearson correlations use up to 34 strictly earlier closed, consecutive observations (minimum 20): rho(V,C), rho(sigma,abs(V)), rho(sigma,abs(C)). A constant series has undefined correlation and produces the minimum width.

Quality is the weighted geometric mean: positive rho(V,C) to power 0.39, absolute rho(sigma,abs(V)) to power 0.305, and absolute rho(sigma,abs(C)) to power 0.305, multiplied by the share of the latest eight observations whose two strengths have the same nonzero sign outside +/-0.07. The two sigma correlations must agree in sign. Both direct and inverse sigma associations count; the tooltip names the relationship. This treats coherent bearish and bullish episodes symmetrically. Quality is descriptive association, not a probability.

Sigma associations carry 61% of the weighting and inter-Strength correlation carries 39%. Target width = 1 + 7*quality; recursive smoothing alpha = 0.35. Gaps and missing closed inputs reset the window. Current/live values never enter their own displayed width. The alternate C×V width mode remains available with its thick width also raised to 8.

This module changes only displayed thickness. Price/WLR coordinates, the display-only color deadband, candle palettes, archived feature width, forecasts and policy lock hashes retain their current definitions.
