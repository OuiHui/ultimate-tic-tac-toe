-- Create the games table
CREATE TABLE games (
  code TEXT PRIMARY KEY,
  state JSONB NOT NULL,
  player_x TEXT,
  player_o TEXT,
  player_x_id TEXT,
  player_o_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (in case it's not already)
ALTER TABLE games ENABLE ROW LEVEL SECURITY;

-- Create policies to allow public (anon) access for all operations
-- Note: In a production app with auth, you'd want stricter policies.
CREATE POLICY "Allow public select" ON games FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON games FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON games FOR UPDATE USING (true);
CREATE POLICY "Allow public delete" ON games FOR DELETE USING (true);

-- Enable Realtime for the games table
alter publication supabase_realtime add table games;

-- Create the claim_timeout RPC function
CREATE OR REPLACE FUNCTION claim_timeout(game_code text, timed_out_player text)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Logic to handle claiming timeout
  -- This will depend on exactly what needs to be updated.
  -- Example:
  UPDATE games 
  SET 
    state = jsonb_set(
      jsonb_set(state, '{gameOver}', 'true'::jsonb), 
      '{gameWinner}', 
      to_jsonb(CASE WHEN timed_out_player = 'X' THEN 'O' ELSE 'X' END)
    ),
    updated_at = NOW()
  WHERE code = game_code;
END;
$$;
