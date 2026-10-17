"""Synthetic parser tests only; these rows are NOT field observations."""
import tempfile,unittest
from pathlib import Path
from analyze_measurements import analyze
HEADER='sensor_id,start_utc,duration_seconds,measured_w_m2,predicted_w_m2,quality\n'
class Measurements(unittest.TestCase):
 def run_data(self,rows):
  with tempfile.TemporaryDirectory() as d:
   p=Path(d)/'test.csv';p.write_text(HEADER+rows);return analyze(p)
 def test_no_data_rejected(self):
  with self.assertRaises(ValueError):self.run_data('')
 def test_weighted_error_and_missing_day(self):
  r=self.run_data('s,2026-01-01T00:00:00Z,60,100,110,valid\ns,2026-01-01T00:01:00Z,120,100,90,valid\n')['sensors']['s']
  self.assertAlmostEqual(r['metrics']['biasW_m2'],-10/3);self.assertEqual(r['metrics']['maeW_m2'],10);self.assertFalse(r['days'][0]['complete'])
 def test_complete_daily_energy(self):
  r=self.run_data('s,2026-01-01T00:00:00Z,86400,100,110,valid\n')['sensors']['s']
  self.assertAlmostEqual(r['days'][0]['measuredKWh_m2'],2.4)
 def test_overlap_rejected(self):
  with self.assertRaises(ValueError):self.run_data('s,2026-01-01T00:00:00Z,120,100,110,valid\ns,2026-01-01T00:01:00Z,120,100,90,valid\n')
 def test_exclusion_prevents_complete_day(self):
  r=self.run_data('s,2026-01-01T00:00:00Z,86400,,,sensor_failure\n')['sensors']['s']
  self.assertIsNone(r['metrics']);self.assertFalse(r['days'][0]['complete'])
 def test_naive_timestamp_rejected(self):
  with self.assertRaises(ValueError):self.run_data('s,2026-01-01T00:00:00,60,100,110,valid\n')
if __name__=='__main__':unittest.main()
