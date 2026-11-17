from datetime import datetime, timedelta, timezone

ALMATY = timezone(timedelta(hours=5))

def now_local():
    return datetime.now(ALMATY).replace(tzinfo=None)