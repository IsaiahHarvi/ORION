import bz2
import gzip
import os
import shutil
import tarfile


def enforce_dir_size_limit(directory, max_size_bytes=15 * 1024 * 1024 * 1024):
    """
    Ensure that the total size of files in the directory is below max_size_bytes.
    Deletes oldest files first if necessary.
    """
    files = [os.path.join(directory, f) for f in os.listdir(directory)
             if os.path.isfile(os.path.join(directory, f))]

    files.sort(key=lambda x: os.path.getmtime(x))

    total_size = sum(os.path.getsize(f) for f in files)

    while total_size > max_size_bytes and files:
        oldest_file = files.pop(0)
        try:
            file_size = os.path.getsize(oldest_file)
            os.remove(oldest_file)
            total_size -= file_size
            print(f"Deleted {oldest_file} of size {file_size} bytes to enforce size limit.")
        except Exception as e:
            print(f"Error deleting {oldest_file}: {e}")
