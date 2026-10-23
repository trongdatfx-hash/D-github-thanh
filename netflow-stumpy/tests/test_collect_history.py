import hashlib
import importlib.util
import io
from pathlib import Path
import unittest
from unittest.mock import patch
import urllib.error
import zipfile

spec=importlib.util.spec_from_file_location('collector',Path(__file__).parents[1]/'collect-history.py')
c=importlib.util.module_from_spec(spec)
spec.loader.exec_module(c)

class CollectorTests(unittest.TestCase):
    def setUp(self): c.SOURCE='rest'

    def test_metadata_never_marks_stale_rest_or_archive_as_live(self):
        now=100*c.STEP
        for source,last,expected in [('rest',now-c.STEP,'live'),('rest',now-5*c.STEP,'delayed'),('daily-archive',now-c.STEP,'delayed')]:
            result=c.collection_metadata(source,now,{'SPYUSDT':last,'QQQUSDT':last})
            self.assertEqual(result['status'],expected)
        self.assertEqual(c.collection_metadata('rest',now,{'SPYUSDT':now-c.STEP,'QQQUSDT':now-5*c.STEP})['status'],'delayed')
        with self.assertRaises(RuntimeError):
            c.collection_metadata('rest',now,{'SPYUSDT':now-c.STEP})

    def test_451_is_not_retried(self):
        error=urllib.error.HTTPError('url',451,'restricted',{},None)
        with patch.object(c.urllib.request,'urlopen',side_effect=error) as request:
            with self.assertRaises(urllib.error.HTTPError): c.get_json('/fapi/v1/time')
            self.assertEqual(request.call_count,1)

    def test_archive_columns_and_checksum(self):
        payload=io.BytesIO()
        with zipfile.ZipFile(payload,'w') as z:
            z.writestr('SPYUSDT-15m-2026-10-20.csv','open_time,open,high,low,close,volume,close_time,quote_volume,count,taker_base,taker_quote,ignore\n0,1,3,1,2,4,899999,8,2,1,5,0\n')
        data=payload.getvalue()
        with patch.object(c.urllib.request,'urlopen',side_effect=[io.BytesIO(data),io.BytesIO(hashlib.sha256(data).hexdigest().encode())]):
            self.assertEqual(c.archive_day('SPYUSDT','2026-10-20'),[[0,1.,3.,1.,2.,4.,899999,8.,5.]])
        with patch.object(c.urllib.request,'urlopen',side_effect=[io.BytesIO(data),io.BytesIO(b'bad')]):
            with self.assertRaises(ValueError): c.archive_day('SPYUSDT','2026-10-20')

    def test_only_missing_archive_is_optional(self):
        for code in (404,500):
            error=urllib.error.HTTPError('url',code,'error',{},None)
            with patch.object(c.urllib.request,'urlopen',side_effect=error):
                if code==404: self.assertEqual(c.archive_day('SPYUSDT','2026-10-20'),[])
                else:
                    with self.assertRaises(urllib.error.HTTPError): c.archive_day('SPYUSDT','2026-10-20')

    def test_last_day_of_month_is_included(self):
        start=c.month_start_ms(2026,9)+29*86400000
        with patch.object(c,'archive_day',return_value=[]) as fetch:
            c.archive_symbol('SPYUSDT',start,c.month_start_ms(2026,10)-1)
            fetch.assert_called_once_with('SPYUSDT','2026-09-30')

    def test_klines_restriction_switches_source(self):
        error=urllib.error.HTTPError('url',451,'restricted',{},None)
        with patch.object(c,'get_json',side_effect=error),patch.object(c,'archive_symbol',return_value=[[1]]) as archive:
            self.assertEqual(c.fetch_symbol('SPYUSDT',0,900000),[[1]])
            self.assertEqual(c.SOURCE,'daily-archive')
            archive.assert_called_once_with('SPYUSDT',0,900000)

if __name__=='__main__': unittest.main()
