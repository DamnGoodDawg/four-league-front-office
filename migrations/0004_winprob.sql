-- Live win probability per matchup (home side, 0..1). ESPN provides it
-- natively (side.winProbability); Yahoo's is computed from both rosters'
-- remaining projections with damping. NULL when unknowable.
ALTER TABLE matchups ADD COLUMN home_win_prob REAL;
