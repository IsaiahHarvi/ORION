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

def extract_nexrad_file(filepath, dest_dir):
    # Check if it's a tar archive first.
    if tarfile.is_tarfile(filepath):
        with tarfile.open(filepath, 'r:*') as tar:
            tar.extractall(path=dest_dir)
        print(f"Extracted tar file: {filepath}")
    else:
        # Read the first few bytes to determine file type
        with open(filepath, 'rb') as f:
            magic = f.read(3)

        # Check for gzip magic number (1F 8B)
        if magic[:2] == b'\x1f\x8b':
            output_file = os.path.join(dest_dir, os.path.basename(os.path.splitext(filepath)[0]))
            with gzip.open(filepath, 'rb') as f_in, open(output_file, 'wb') as f_out:
                shutil.copyfileobj(f_in, f_out)
            print(f"Decompressed gzip file: {filepath} -> {output_file}")
        # Check for bzip2 magic number ("BZh")
        elif magic == b'BZh':
            output_file = os.path.join(dest_dir, os.path.basename(os.path.splitext(filepath)[0]))
            with bz2.open(filepath, 'rb') as f_in, open(output_file, 'wb') as f_out:
                shutil.copyfileobj(f_in, f_out)
            print(f"Decompressed bzip2 file: {filepath} -> {output_file}")
        else:
            print(f"File {filepath} is not recognized as a tar, gzip, or bzip2 file.")
