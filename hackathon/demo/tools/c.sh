#!/bin/zsh
# usage: c.sh PORT CMD [BODY]
curl -s -X POST "http://localhost:$1/$2" --data-binary "${3:-}" ; echo
