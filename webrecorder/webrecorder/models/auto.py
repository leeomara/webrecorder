from webrecorder.models.base import RedisUniqueComponent
import json
import requests
import os


# ============================================================================
class Auto(RedisUniqueComponent):
    MY_TYPE = 'auto'
    ALL_KEYS = 'a:{auto}:*'

    INFO_KEY = 'a:{auto}:info'
    Q_KEY = 'a:{auto}:q'
    QP_KEY = 'a:{auto}:qp'
    SEEN_KEY = 'a:{auto}:seen'

    SCOPE_KEY = 'a:{auto}:scope'

    BR_KEY = 'a:{auto}:br'

    DEFAULT_DEPTH = 1

    DEFAULT_NUM_BROWSERS = 2

    DEFAULT_BROWSER = 'chrome:67'

    BROWSER_API_URL = 'http://shepherd:9020/api/auto-pool'

    def __init__(self, **kwargs):
        super(Auto, self).__init__(**kwargs)
        self.frontier_q_key = self.Q_KEY.format(auto=self.my_id)

        self.seen_key = self.SEEN_KEY.format(auto=self.my_id)

        self.browser_key = self.BR_KEY.format(auto=self.my_id)

        self.pending_q_key = self.QP_KEY.format(auto=self.my_id)

        self.scopes_key = self.SCOPE_KEY.format(auto=self.my_id)

    def init_new(self, collection, props=None):
        self.owner = collection

        aid = self._create_new_id()

        props = props or {}

        self.data = {
                     'num_browsers': props.get('num_browsers', self.DEFAULT_NUM_BROWSERS),
                     'crawl_depth': props.get('crawl_depth', self.DEFAULT_DEPTH),
                     'num_tabs': props.get('num_tabs', 1),
                     'owner': collection.my_id,
                     'status': 'new',
                    }

        self._init_new()

        scopes = props.get('scopes')
        if scopes:
            for scope in scopes:
                self.redis.sadd(self.scopes_key, scope)

        return aid

    def queue_urls(self, urls):
        for url in urls:
            url_req = {'url': url, 'depth': 0}
            print('Queuing: ' + str(url_req))
            self.redis.rpush(self.frontier_q_key, json.dumps(url_req))

            # add to seen list to avoid dupes
            self.redis.sadd(self.seen_key, url)

        return {'success': True}

    def do_request(self, url_path, post_data=None):
        err = None
        try:
            res = requests.post(self.BROWSER_API_URL + url_path, json=post_data)
            return res.json()
        except Exception as e:
            err = {'error': str(e)}
            if res:
                err['details'] = res.text

            return err

    def start(self):
        if self['status'] == 'running':
            return {'error': 'already_running'}

        collection = self.get_owner()

        recording = collection.create_recording(rec_type='auto')

        browser_id = self.get_prop('browser_id') or self.DEFAULT_BROWSER

        browser_data = {
                        'user': collection.get_owner().name,
                        'coll': collection.my_id,
                        'rec': recording.my_id,
                        'browser_can_write': '1',
                        'browser': browser_id,
                        'request_ts': '',
                        'type': 'record',
                        'auto_id': self.my_id,
                       }

        environ = {'AUTO_ID': self.my_id,
                   'URL': 'about:blank',
                   'REDIS_URL': os.environ['REDIS_BASE_URL'],
                  }

        opts = dict(overrides={'browser': 'oldwebtoday/' + browser_id},
                    user_params=browser_data,
                    environ=environ)

        errors = []

        for x in range(int(self['num_browsers'])):
            res = self.do_request('/request_flock/auto-vnc', opts)
            reqid = res.get('reqid')
            if not reqid:
                if 'error' in res:
                    errors.append(res['error'])
                continue

            res = self.do_request('/start_flock/{0}'.format(reqid))

            if 'error' in res:
                errors.append(res['error'])
            else:
                self.redis.sadd(self.browser_key, reqid)

        if not errors:
            self['status'] = 'running'
            return {'success': True, 'browsers': list(self.redis.smembers(self.browser_key))}

        else:
            return {'error': 'not_started', 'details': errors}

    def stop(self):
        if self['status'] != 'running':
            return {'error': 'not_running'}

        errors = []

        for reqid in self.redis.smembers(self.browser_key):
            res = self.do_request('/stop_flock/{0}'.format(reqid))
            if 'error' in res:
                errors.append(res['error'])

        if not errors:
            self['status'] = 'stopped'
            return {'success': True}
        else:
            return {'error': 'not_stopped', 'details': errors}


    def serialize(self):
        data = super(Auto, self).serialize()
        browsers = self.redis.smembers(self.browser_key)

        #for reqid in browsers:
        #    tabs = self.redis.hgetall(self.get_tab_key(reqid))
        #    if tabs:
        #        browsers[reqid] = tabs

        data['browsers'] = list(browsers)
        data['scopes'] = list(self.redis.smembers(self.scopes_key))

        data['queue'] = self.redis.lrange(self.frontier_q_key, 0, -1)
        data['pending'] = list(self.redis.smembers(self.pending_q_key))
        data['seen'] = list(self.redis.smembers(self.seen_key))
        return data

    def delete_me(self):
        self.access.assert_can_admin_coll(self.get_owner())

        res = self.stop()
        print(res)

        if not self.delete_object():
            return False




